import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, ManyToOne, JoinColumn } from 'typeorm';
import { CrewDocumentType } from '../enums';
import { CrewMember } from './CrewMember';
import { Production } from './Production';

@Entity('crew_documents')
export class CrewDocument {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'uuid', name: 'crew_member_id' })
  crewMemberId: string;

  @ManyToOne(() => CrewMember, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'crew_member_id' })
  crewMember: CrewMember;

  @Column({ type: 'text', name: 'document_type' })
  documentType: CrewDocumentType;

  @Column({ type: 'uuid', name: 'production_id', nullable: true })
  productionId: string | null;

  @ManyToOne(() => Production, { nullable: true })
  @JoinColumn({ name: 'production_id' })
  production: Production | null;

  @Column({ type: 'text', name: 'file_url' })
  fileUrl: string;

  @Column({ type: 'text', name: 'file_name' })
  fileName: string;

  @CreateDateColumn({ name: 'uploaded_at', type: 'timestamptz' })
  uploadedAt: Date;
}
