import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, UpdateDateColumn, OneToOne, JoinColumn } from 'typeorm';
import { Production } from './Production';

@Entity('cost_plus_budgets')
export class CostPlusBudget {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'uuid', name: 'production_id', unique: true })
  productionId: string;

  @OneToOne(() => Production, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'production_id' })
  production: Production;

  @Column({ type: 'decimal', precision: 14, scale: 2, name: 'total_budget', nullable: true })
  totalBudget: number | null;

  @Column({ type: 'decimal', precision: 5, scale: 4, name: 'margin_rate', default: 0.10 })
  marginRate: number;

  @Column({ type: 'integer', name: 'contracted_weeks', default: 0 })
  contractedWeeks: number;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' })
  updatedAt: Date;
}
