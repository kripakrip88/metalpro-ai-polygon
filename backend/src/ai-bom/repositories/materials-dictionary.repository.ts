import { Injectable } from "@nestjs/common";

@Injectable()
export class MaterialsDictionaryRepository {
  async findByAlias(alias: string) { throw new Error("Not implemented"); }
  async findAll() { throw new Error("Not implemented"); }
  async findById(id: string) { throw new Error("Not implemented"); }
}
