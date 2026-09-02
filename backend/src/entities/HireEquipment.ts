import {
  Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, UpdateDateColumn, ManyToOne, JoinColumn,
} from 'typeorm';
import { Production } from './Production';
import { Supplier } from './Supplier';

@Entity('hire_equipment')
export class HireEquipment {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'equipment_type', length: 100 })
  equipmentType: string;

  @Column({ name: 'supplier_id', type: 'uuid', nullable: true })
  supplierId: string | null;

  @ManyToOne(() => Supplier, { nullable: true, onDelete: 'SET NULL' })
  @JoinColumn({ name: 'supplier_id' })
  supplier: Supplier | null;

  @Column({ name: 'supplier_name', length: 150 })
  supplierName: string;

  @Column({ type: 'text', nullable: true })
  description: string | null;

  @Column({ name: 'production_id', type: 'uuid' })
  productionId: string;

  @ManyToOne(() => Production, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'production_id' })
  production: Production;

  @Column({ name: 'hire_start_date', type: 'date' })
  hireStartDate: string;

  @Column({ name: 'weekly_hire_rate', type: 'numeric', precision: 12, scale: 2, default: 0 })
  weeklyHireRate: number;

  @Column({ name: 'return_date', type: 'date', nullable: true })
  returnDate: string | null;

  @Column({ length: 20, default: 'active' })
  status: 'active' | 'returned';

  @Column({ type: 'text', nullable: true })
  notes: string | null;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;
}
