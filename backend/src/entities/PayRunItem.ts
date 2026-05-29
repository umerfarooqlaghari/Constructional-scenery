import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, ManyToOne, JoinColumn } from 'typeorm';
import { EmploymentStatus } from '../enums';
import { PayRun } from './PayRun';
import { Timesheet } from './Timesheet';
import { CrewMember } from './CrewMember';
import { encryptTransformer } from '../utils/crypto';

@Entity('pay_run_items')
export class PayRunItem {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'uuid', name: 'pay_run_id' })
  payRunId: string;

  @ManyToOne(() => PayRun, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'pay_run_id' })
  payRun: PayRun;

  @Column({ type: 'uuid', name: 'timesheet_id' })
  timesheetId: string;

  @ManyToOne(() => Timesheet)
  @JoinColumn({ name: 'timesheet_id' })
  timesheet: Timesheet;

  @Column({ type: 'uuid', name: 'crew_member_id' })
  crewMemberId: string;

  @ManyToOne(() => CrewMember)
  @JoinColumn({ name: 'crew_member_id' })
  crewMember: CrewMember;

  @Column({ type: 'text', name: 'employment_type', nullable: true })
  employmentType: EmploymentStatus | null;

  @Column({ type: 'decimal', precision: 12, scale: 2, name: 'gross_amount' })
  grossAmount: number;

  @Column({ type: 'decimal', precision: 12, scale: 2, name: 'withholding_amount', default: 0 })
  withholdingAmount: number;

  @Column({ type: 'decimal', precision: 12, scale: 2, name: 'net_amount' })
  netAmount: number;

  // Encrypted snapshot of crew bank details at time of pay run
  @Column({ type: 'text', name: 'sort_code', nullable: true, transformer: encryptTransformer })
  sortCode: string | null;

  @Column({ type: 'text', name: 'account_number', nullable: true, transformer: encryptTransformer })
  accountNumber: string | null;

  @Column({ type: 'text', name: 'account_name', nullable: true, transformer: encryptTransformer })
  accountName: string | null;

  @Column({ type: 'text', nullable: true })
  reference: string | null;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt: Date;
}
