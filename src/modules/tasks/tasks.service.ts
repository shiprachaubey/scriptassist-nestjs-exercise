import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, Repository } from 'typeorm';
import { Task } from './entities/task.entity';
import { CreateTaskDto } from './dto/create-task.dto';
import { UpdateTaskDto } from './dto/update-task.dto';
import { InjectQueue } from '@nestjs/bullmq';
import { Queue } from 'bullmq';
import { TaskStatus } from './enums/task-status.enum';
import { TaskQueryDto } from './dto/task-query.dto';
import { PaginatedTasksResponse } from './interfaces/paginated-tasks.interface';
import { Like } from 'typeorm';
import { CacheService } from '../../common/services/cache.service';

@Injectable()
export class TasksService {
  private readonly CACHE_TTL = 60 * 5; // 5 minutes
  private readonly CACHE_PREFIX = 'task';

  constructor(
    @InjectRepository(Task)
    private tasksRepository: Repository<Task>,
    @InjectQueue('task-processing')
    private taskQueue: Queue,
    private dataSource: DataSource,
    private cacheService: CacheService,
  ) {}

  async create(createTaskDto: CreateTaskDto): Promise<Task> {
    const queryRunner = this.dataSource.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();

    try {
      const task = this.tasksRepository.create(createTaskDto);
      const savedTask = await queryRunner.manager.save(Task, task);

      await this.taskQueue.add('task-status-update', {
        taskId: savedTask.id,
        status: savedTask.status,
      }, {
        attempts: 3,
        backoff: {
          type: 'exponential',
          delay: 1000,
        },
      });

      await queryRunner.commitTransaction();
      
      // Invalidate relevant caches
      await this.invalidateUserTasksCache(savedTask.userId);
      
      return savedTask;
    } catch (error) {
      await queryRunner.rollbackTransaction();
      throw error;
    } finally {
      await queryRunner.release();
    }
  }

  async findAll(query: TaskQueryDto): Promise<PaginatedTasksResponse> {
    const cacheKey = this.cacheService.generateKey(`${this.CACHE_PREFIX}:list`, query);
    const cachedResult = await this.cacheService.get<PaginatedTasksResponse>(cacheKey);

    if (cachedResult) {
      return cachedResult;
    }

    const { page = 1, limit = 10, sortBy = 'createdAt', sortOrder = 'DESC', status, priority, userId, search } = query;
    const skip = (page - 1) * limit;

    const queryBuilder = this.tasksRepository
      .createQueryBuilder('task')
      .leftJoinAndSelect('task.user', 'user')
      .where('1=1');

    if (status) {
      queryBuilder.andWhere('task.status = :status', { status });
    }

    if (priority) {
      queryBuilder.andWhere('task.priority = :priority', { priority });
    }

    if (userId) {
      queryBuilder.andWhere('task.userId = :userId', { userId });
    }

    if (search) {
      queryBuilder.andWhere(
        '(task.title ILIKE :search OR task.description ILIKE :search)',
        { search: `%${search}%` }
      );
    }

    const total = await queryBuilder.getCount();

    const tasks = await queryBuilder
      .orderBy(`task.${sortBy}`, sortOrder)
      .skip(skip)
      .take(limit)
      .getMany();

    const totalPages = Math.ceil(total / limit);

    const result = {
      data: tasks,
      meta: {
        total,
        page,
        limit,
        totalPages,
        hasNextPage: page < totalPages,
        hasPreviousPage: page > 1,
      },
    };

    // Cache the result
    await this.cacheService.set(cacheKey, result, this.CACHE_TTL);

    return result;
  }

  async findOne(id: string): Promise<Task> {
    const cacheKey = `${this.CACHE_PREFIX}:${id}`;
    const cachedTask = await this.cacheService.get<Task>(cacheKey);

    if (cachedTask) {
      return cachedTask;
    }

    const task = await this.tasksRepository
      .createQueryBuilder('task')
      .leftJoinAndSelect('task.user', 'user')
      .where('task.id = :id', { id })
      .getOne();

    if (!task) {
      throw new NotFoundException(`Task with ID ${id} not found`);
    }

    // Cache the task
    await this.cacheService.set(cacheKey, task, this.CACHE_TTL);

    return task;
  }

  async update(id: string, updateTaskDto: UpdateTaskDto): Promise<Task> {
    const queryRunner = this.dataSource.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();

    try {
      const task = await this.findOne(id);
      const originalStatus = task.status;

      Object.assign(task, updateTaskDto);
      const updatedTask = await queryRunner.manager.save(Task, task);

      if (originalStatus !== updatedTask.status) {
        await this.taskQueue.add('task-status-update', {
          taskId: updatedTask.id,
          status: updatedTask.status,
        }, {
          attempts: 3,
          backoff: {
            type: 'exponential',
            delay: 1000,
          },
        });
      }

      await queryRunner.commitTransaction();

      // Invalidate caches
      await this.invalidateTaskCache(id);
      await this.invalidateUserTasksCache(task.userId);

      return updatedTask;
    } catch (error) {
      await queryRunner.rollbackTransaction();
      throw error;
    } finally {
      await queryRunner.release();
    }
  }

  async remove(id: string): Promise<void> {
    const queryRunner = this.dataSource.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();

    try {
      const task = await this.findOne(id);
      await queryRunner.manager.remove(Task, task);
      await queryRunner.commitTransaction();

      // Invalidate caches
      await this.invalidateTaskCache(id);
      await this.invalidateUserTasksCache(task.userId);
    } catch (error) {
      await queryRunner.rollbackTransaction();
      throw error;
    } finally {
      await queryRunner.release();
    }
  }

  async findByStatus(status: TaskStatus, query: TaskQueryDto): Promise<PaginatedTasksResponse> {
    return this.findAll({ ...query, status });
  }

  async updateStatus(id: string, status: TaskStatus): Promise<Task> {
    const queryRunner = this.dataSource.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();

    try {
      const task = await this.findOne(id);
      task.status = status;
      const updatedTask = await queryRunner.manager.save(Task, task);
      await queryRunner.commitTransaction();

      // Invalidate caches
      await this.invalidateTaskCache(id);
      await this.invalidateUserTasksCache(task.userId);

      return updatedTask;
    } catch (error) {
      await queryRunner.rollbackTransaction();
      throw error;
    } finally {
      await queryRunner.release();
    }
  }

  private async invalidateTaskCache(taskId: string): Promise<void> {
    await this.cacheService.del(`${this.CACHE_PREFIX}:${taskId}`);
  }

  private async invalidateUserTasksCache(userId: string): Promise<void> {
    // Invalidate all list caches for this user
    const pattern = `${this.CACHE_PREFIX}:list:*`;
    // Since we're using a simplified cache implementation,
    // we'll clear all caches when a user's tasks change
    await this.cacheService.clear();
  }
}
