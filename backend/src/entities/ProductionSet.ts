import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, UpdateDateColumn, ManyToOne, JoinColumn, Index } from 'typeorm';
import { SetCompletionStatus } from '../enums';
import { Production } from './Production';

@Entity('sets')
@Index('idx_sets_production', ['productionId'])
@Index('idx_sets_handover', ['handoverDate'])
export class ProductionSet {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'uuid', name: 'production_id' })
  productionId: string;

  @ManyToOne(() => Production, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'production_id' })
  production: Production;

  @Column({ type: 'text', name: 'set_number', nullable: true })
  setNumber: string | null;

  @Column({ type: 'text', name: 'set_name' })
  setName: string;

  @Column({ type: 'text', name: 'shoot_week', nullable: true })
  shootWeek: string | null;

  @Column({ type: 'date', name: 'handover_date', nullable: true })
  handoverDate: string | null;

  @Column({ type: 'text', name: 'completion_status', default: SetCompletionStatus.NOT_STARTED })
  completionStatus: SetCompletionStatus;

  @Column({ type: 'text', nullable: true })
  notes: string | null;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' })
  updatedAt: Date;
}
