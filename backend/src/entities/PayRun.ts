import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, ManyToOne, JoinColumn, Unique } from 'typeorm';
import { PayRunStatus } from '../enums';
import { Production } from './Production';
import { User } from './User';

@Entity('pay_runs')
@Unique(['productionId', 'weekEndingDate'])
export class PayRun {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'uuid', name: 'production_id' })
  productionId: string;

  @ManyToOne(() => Production)
  @JoinColumn({ name: 'production_id' })
  production: Production;

  @Column({ type: 'date', name: 'week_ending_date' })
  weekEndingDate: string;

  @Column({ type: 'text', default: PayRunStatus.DRAFT })
  status: PayRunStatus;

  @Column({ type: 'uuid', name: 'created_by', nullable: true })
  createdById: string | null;

  @ManyToOne(() => User, { nullable: true })
  @JoinColumn({ name: 'created_by' })
  createdBy: User | null;

  @Column({ name: 'processed_at', type: 'timestamptz', nullable: true })
  processedAt: Date | null;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt: Date;
}
