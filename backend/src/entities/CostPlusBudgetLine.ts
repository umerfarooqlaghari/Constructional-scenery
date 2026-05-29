import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, ManyToOne, JoinColumn } from 'typeorm';
import { CostPlusBudget } from './CostPlusBudget';

@Entity('cost_plus_budget_lines')
export class CostPlusBudgetLine {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'uuid', name: 'budget_id' })
  budgetId: string;

  @ManyToOne(() => CostPlusBudget, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'budget_id' })
  budget: CostPlusBudget;

  @Column({ type: 'text', name: 'account_code', nullable: true })
  accountCode: string | null;

  @Column({ type: 'text' })
  description: string;

  @Column({ type: 'decimal', precision: 12, scale: 2, name: 'weekly_cost', default: 0 })
  weeklyCost: number;

  @Column({ type: 'integer', default: 0 })
  weeks: number;

  @Column({ type: 'decimal', precision: 14, scale: 2, default: 0 })
  total: number;

  @Column({ type: 'integer', name: 'sort_order', default: 0 })
  sortOrder: number;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt: Date;
}
