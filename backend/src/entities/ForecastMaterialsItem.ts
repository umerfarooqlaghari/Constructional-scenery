import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, ManyToOne, JoinColumn } from 'typeorm';
import { Forecast } from './Forecast';
import { SupplierCatalogue } from './SupplierCatalogue';

@Entity('forecast_materials_items')
export class ForecastMaterialsItem {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'uuid', name: 'forecast_id' })
  forecastId: string;

  @ManyToOne(() => Forecast, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'forecast_id' })
  forecast: Forecast;

  @Column({ type: 'uuid', name: 'supplier_catalogue_id', nullable: true })
  supplierCatalogueId: string | null;

  @ManyToOne(() => SupplierCatalogue, { nullable: true })
  @JoinColumn({ name: 'supplier_catalogue_id' })
  supplierCatalogue: SupplierCatalogue | null;

  @Column({ type: 'text', name: 'supplier_name', nullable: true })
  supplierName: string | null;

  @Column({ type: 'text', name: 'product_description', nullable: true })
  productDescription: string | null;

  @Column({ type: 'decimal', precision: 10, scale: 2, default: 1 })
  quantity: number;

  @Column({ type: 'decimal', precision: 10, scale: 2, name: 'unit_price', nullable: true })
  unitPrice: number | null;

  @Column({ type: 'decimal', precision: 14, scale: 2, nullable: true })
  subtotal: number | null;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt: Date;
}
