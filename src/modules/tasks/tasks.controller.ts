import { Controller, Get, Post, Body, Patch, Param, Delete, UseGuards, Query, UseInterceptors } from '@nestjs/common'; //shipra
import { TasksService } from './tasks.service';
import { CreateTaskDto } from './dto/create-task.dto';
import { UpdateTaskDto } from './dto/update-task.dto';
import { ApiBearerAuth, ApiOperation, ApiQuery, ApiTags } from '@nestjs/swagger';
import { Task } from './entities/task.entity';
import { TaskStatus } from './enums/task-status.enum';
import { TaskPriority } from './enums/task-priority.enum';
import { RateLimitGuard } from '../../common/guards/rate-limit.guard';
import { RateLimit } from '../../common/decorators/rate-limit.decorator';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';//shipra
import { TaskQueryDto } from './dto/task-query.dto';//shipra
import { PaginatedTasksResponse } from './interfaces/paginated-tasks.interface';//shipra

@ApiTags('tasks')
@Controller('tasks')
@UseGuards(JwtAuthGuard, RateLimitGuard)
@RateLimit({ limit: 100, windowMs: 60000 })
@ApiBearerAuth()
export class TasksController {
  constructor(
    private readonly tasksService: TasksService,
  ) {}

  @Post()
  @ApiOperation({ summary: 'Create a new task' })
  //added shipra
  create(@Body() createTaskDto: CreateTaskDto): Promise<Task> {
    return this.tasksService.create(createTaskDto);
  }

  @Get()
  @ApiOperation({ summary: 'Get all tasks with pagination and filtering' })
  findAll(@Query() query: TaskQueryDto): Promise<PaginatedTasksResponse> {
    return this.tasksService.findAll(query);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get a task by ID' })
  findOne(@Param('id') id: string): Promise<Task> {
    return this.tasksService.findOne(id);
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Update a task' })
  update(
    @Param('id') id: string,
    @Body() updateTaskDto: UpdateTaskDto,
  ): Promise<Task> {
    return this.tasksService.update(id, updateTaskDto);
  }

  @Delete(':id')
  @ApiOperation({ summary: 'Delete a task' })
  remove(@Param('id') id: string): Promise<void> {
    return this.tasksService.remove(id);
  }
//added shipra
  @Get('status/:status')
  @ApiOperation({ summary: 'Get tasks by status with pagination' })
  findByStatus(
    @Param('status') status: TaskStatus,
    @Query() query: TaskQueryDto,
  ): Promise<PaginatedTasksResponse> {
    return this.tasksService.findByStatus(status, query);
  }
} 