import { Injectable } from "@nestjs/common";

@Injectable()
export class SupplierRepository {
  async findAll() { throw new Error("Not implemented"); }
  async findByName(name: string) { throw new Error("Not implemented"); }
  async findMaterialBySupplierAlias(supplierId: string, supplierName: string) { throw new Error("Not implemented"); }
}
