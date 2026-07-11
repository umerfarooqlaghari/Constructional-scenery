import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, ManyToOne, JoinColumn, Index } from 'typeorm';
import { DayOfWeek } from '../enums';
import { Timesheet } from './Timesheet';

@Entity('timesheet_entries')
@Index('idx_timesheet_entries_timesheet', ['timesheetId'])
export class TimesheetEntry {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'uuid', name: 'timesheet_id' })
  timesheetId: string;

  @ManyToOne(() => Timesheet, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'timesheet_id' })
  timesheet: Timesheet;

  @Column({ type: 'date' })
  date: string;

  @Column({ type: 'text', name: 'day_of_week' })
  dayOfWeek: DayOfWeek;

  @Column({ type: 'boolean', name: 'full_day_worked', default: false })
  fullDayWorked: boolean;

  @Column({ type: 'decimal', precision: 6, scale: 2, name: 'overtime_hours', default: 0 })
  overtimeHours: number;

  @Column({ type: 'text', name: 'set_number', nullable: true })
  setNumber: string | null;

  @Column({ type: 'text', nullable: true })
  site: string | null;

  @Column({ type: 'decimal', precision: 8, scale: 2, default: 0 })
  travel: number;

  @Column({ type: 'boolean', name: 'meal_breakfast', default: false })
  mealBreakfast: boolean;

  @Column({ type: 'boolean', name: 'meal_lunch', default: false })
  mealLunch: boolean;

  @Column({ type: 'boolean', name: 'meal_supper', default: false })
  mealSupper: boolean;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt: Date;
}
