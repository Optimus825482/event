import { CreateTableTypeDto } from './create-table-type.dto';

// Tüm alanları opsiyonel yapan PartialType alternatifi
export class UpdateTableTypeDto implements Partial<CreateTableTypeDto> {
  name?: string;
  type?: string;
  defaultCapacity?: number;
  color?: string;
  icon?: string;
  basePrice?: number;
  width?: number;
  height?: number;
  shape?: string;
}
