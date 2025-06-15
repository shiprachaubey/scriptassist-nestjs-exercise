import { MigrationInterface, QueryRunner } from 'typeorm';

export class CreateInitialSchema1710752400000 implements MigrationInterface {
  name = 'CreateInitialSchema1710752400000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    // Create tables for users, tasks, and other entities
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "users" (
        "id" uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
        "email" varchar NOT NULL UNIQUE,
        "name" varchar NOT NULL,
        "password" varchar NOT NULL,
        "role" varchar NOT NULL DEFAULT 'user',
        "created_at" TIMESTAMP NOT NULL DEFAULT now(),
        "updated_at" TIMESTAMP NOT NULL DEFAULT now()
      )
    `);

    // Enable UUID extension if not already enabled
    await queryRunner.query(`CREATE EXTENSION IF NOT EXISTS "uuid-ossp"`);

    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "tasks" (
        "id" uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
        "title" varchar NOT NULL,
        "description" text,
        "status" varchar NOT NULL DEFAULT 'PENDING',
        "priority" varchar NOT NULL DEFAULT 'MEDIUM',
        "due_date" TIMESTAMP,
        "user_id" uuid NOT NULL,
        "created_at" TIMESTAMP NOT NULL DEFAULT now(),
        "updated_at" TIMESTAMP NOT NULL DEFAULT now(),
        CONSTRAINT "fk_user_id" FOREIGN KEY ("user_id") REFERENCES "users" ("id") ON DELETE CASCADE
      )
    `);
//added shipra
    // Add indexes for better query performance
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "idx_tasks_user_id" ON "tasks" ("user_id");
      CREATE INDEX IF NOT EXISTS "idx_tasks_status" ON "tasks" ("status");
      CREATE INDEX IF NOT EXISTS "idx_tasks_priority" ON "tasks" ("priority");
      CREATE INDEX IF NOT EXISTS "idx_tasks_due_date" ON "tasks" ("due_date");
      CREATE INDEX IF NOT EXISTS "idx_tasks_created_at" ON "tasks" ("created_at");
      CREATE INDEX IF NOT EXISTS "idx_tasks_title_description" ON "tasks" USING gin (to_tsvector('english', title || ' ' || COALESCE(description, '')));
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    // Drop indexes first
    //added shipra
    await queryRunner.query(`
      DROP INDEX IF EXISTS "idx_tasks_user_id";
      DROP INDEX IF EXISTS "idx_tasks_status";
      DROP INDEX IF EXISTS "idx_tasks_priority";
      DROP INDEX IF EXISTS "idx_tasks_due_date";
      DROP INDEX IF EXISTS "idx_tasks_created_at";
      DROP INDEX IF EXISTS "idx_tasks_title_description";
    `);

    // Then drop tables
    await queryRunner.query(`DROP TABLE IF EXISTS "tasks"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "users"`);
  }
} 