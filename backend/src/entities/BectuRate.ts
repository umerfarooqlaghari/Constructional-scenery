import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, Unique } from 'typeorm';

@Entity('bectu_rates')
@Unique(['trade', 'rank', 'rateYear'])
export class BectuRate {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'text' })
  trade: string;

  @Column({ type: 'text' })
  rank: string;

  @Column({ type: 'decimal', precision: 10, scale: 2, name: 'daily_rate', nullable: true })
  dailyRate: number | null;

  @Column({ type: 'decimal', precision: 10, scale: 2, name: 'overtime_rate', nullable: true })
  overtimeRate: number | null;

  @Column({ type: 'decimal', precision: 10, scale: 2, name: 'weekly_rate', nullable: true })
  weeklyRate: number | null;

  @Column({ type: 'text', name: 'rate_year', default: '2026/27' })
  rateYear: string;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt: Date;
}
