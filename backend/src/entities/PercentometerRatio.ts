import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn } from 'typeorm';
import { PercentometerCostType } from '../enums';

@Entity('percentometer_ratios')
export class PercentometerRatio {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'text', name: 'cost_type', unique: true })
  costType: PercentometerCostType;

  @Column({ type: 'decimal', precision: 5, scale: 4 })
  percentage: number;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt: Date;
}
