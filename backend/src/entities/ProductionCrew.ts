import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, ManyToOne, JoinColumn, Index, Unique } from 'typeorm';
import { Production } from './Production';
import { CrewMember } from './CrewMember';

@Entity('production_crew')
@Unique(['productionId', 'crewMemberId'])
@Index('idx_production_crew_production', ['productionId'])
@Index('idx_production_crew_member', ['crewMemberId'])
export class ProductionCrew {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'uuid', name: 'production_id' })
  productionId: string;

  @ManyToOne(() => Production, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'production_id' })
  production: Production;

  @Column({ type: 'uuid', name: 'crew_member_id' })
  crewMemberId: string;

  @ManyToOne(() => CrewMember, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'crew_member_id' })
  crewMember: CrewMember;

  @Column({ type: 'date', name: 'start_date', nullable: true })
  startDate: string | null;

  @Column({ type: 'date', name: 'end_date', nullable: true })
  endDate: string | null;

  @Column({ type: 'text', name: 'contract_url', nullable: true })
  contractUrl: string | null;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt: Date;
}
