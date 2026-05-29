import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, ManyToOne, JoinColumn } from 'typeorm';
import { Production } from './Production';

@Entity('cost_report_invoices')
export class CostReportInvoice {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'uuid', name: 'production_id' })
  productionId: string;

  @ManyToOne(() => Production, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'production_id' })
  production: Production;

  @Column({ type: 'text', name: 'invoice_description', nullable: true })
  invoiceDescription: string | null;

  @Column({ type: 'text', name: 'po_number', nullable: true })
  poNumber: string | null;

  @Column({ type: 'date', nullable: true })
  date: string | null;

  @Column({ type: 'text', name: 'invoice_number', nullable: true })
  invoiceNumber: string | null;

  @Column({ type: 'decimal', precision: 12, scale: 2 })
  amount: number;

  @Column({ type: 'text', nullable: true })
  notes: string | null;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt: Date;
}
