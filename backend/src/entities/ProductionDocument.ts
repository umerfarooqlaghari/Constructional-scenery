import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, ManyToOne, JoinColumn } from 'typeorm';
import { ProductionDocumentType } from '../enums';
import { Production } from './Production';
import { User } from './User';

@Entity('production_documents')
export class ProductionDocument {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'uuid', name: 'production_id' })
  productionId: string;

  @ManyToOne(() => Production, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'production_id' })
  production: Production;

  @Column({ type: 'text', name: 'document_type', nullable: true })
  documentType: ProductionDocumentType | null;

  @Column({ type: 'text', name: 'file_url' })
  fileUrl: string;

  @Column({ type: 'text', name: 'file_name' })
  fileName: string;

  @Column({ type: 'uuid', name: 'uploaded_by', nullable: true })
  uploadedById: string | null;

  @ManyToOne(() => User, { nullable: true })
  @JoinColumn({ name: 'uploaded_by' })
  uploadedBy: User | null;

  @CreateDateColumn({ name: 'uploaded_at', type: 'timestamptz' })
  uploadedAt: Date;
}
