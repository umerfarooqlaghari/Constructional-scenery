import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, ManyToOne, JoinColumn } from 'typeorm';
import { Forecast } from './Forecast';

@Entity('forecast_labour_items')
export class ForecastLabourItem {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'uuid', name: 'forecast_id' })
  forecastId: string;

  @ManyToOne(() => Forecast, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'forecast_id' })
  forecast: Forecast;

  @Column({ type: 'text', name: 'crew_type' })
  crewType: string;

  @Column({ type: 'integer', name: 'number_of_crew', default: 1 })
  numberOfCrew: number;

  @Column({ type: 'integer', name: 'number_of_weeks', default: 1 })
  numberOfWeeks: number;

  @Column({ type: 'decimal', precision: 6, scale: 2, name: 'overtime_hours', default: 0 })
  overtimeHours: number;

  @Column({ type: 'decimal', precision: 10, scale: 2, name: 'weekly_rate', nullable: true })
  weeklyRate: number | null;

  @Column({ type: 'decimal', precision: 10, scale: 2, name: 'overtime_rate', nullable: true })
  overtimeRate: number | null;

  @Column({ type: 'decimal', precision: 14, scale: 2, nullable: true })
  subtotal: number | null;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt: Date;
}
