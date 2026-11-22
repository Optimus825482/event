"use client";

import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  createDepartment,
  createPosition,
  createWorkLocation,
  deleteDepartment,
  deletePosition,
  deleteWorkLocation,
  updateDepartment,
  updatePosition,
  updateWorkLocation,
} from "../actions/catalog";
import {
  createShift,
  createStaffRole,
  deleteShift,
  deleteStaffRole,
  updateShift,
  updateStaffRole,
} from "../actions/roles-shifts";
import type { OrganizationCatalogs } from "../queries";
import { CatalogManager, type CatalogRow, type FieldDef } from "./catalog-manager";

type Access = { canCreate: boolean; canEdit: boolean; canDelete: boolean };

const SORT: FieldDef = { name: "sortOrder", label: "Sıra", type: "number" };
const NAME: FieldDef = { name: "name", label: "Ad", type: "text", required: true };
const DESCRIPTION: FieldDef = { name: "description", label: "Açıklama", type: "text" };

export function OrganizationView({ catalogs, access }: { catalogs: OrganizationCatalogs; access: Access }) {
  return (
    <Tabs defaultValue="departments" className="space-y-4">
      <TabsList className="flex-wrap">
        <TabsTrigger value="departments">Bölümler</TabsTrigger>
        <TabsTrigger value="positions">Unvanlar</TabsTrigger>
        <TabsTrigger value="locations">Görev yerleri</TabsTrigger>
        <TabsTrigger value="shifts">Vardiyalar</TabsTrigger>
        <TabsTrigger value="roles">Personel rolleri</TabsTrigger>
      </TabsList>

      <TabsContent value="departments">
        <CatalogManager
          noun="Bölüm"
          items={catalogs.departments as CatalogRow[]}
          fields={[NAME, DESCRIPTION, { name: "color", label: "Renk", type: "color" }, SORT]}
          columns={[
            { name: "name", label: "Ad" },
            { name: "description", label: "Açıklama" },
            { name: "color", label: "Renk" },
          ]}
          create={createDepartment}
          update={updateDepartment}
          remove={deleteDepartment}
          {...access}
        />
      </TabsContent>

      <TabsContent value="positions">
        <CatalogManager
          noun="Unvan"
          items={catalogs.positions as CatalogRow[]}
          fields={[NAME, DESCRIPTION, SORT]}
          columns={[
            { name: "name", label: "Ad" },
            { name: "description", label: "Açıklama" },
          ]}
          create={createPosition}
          update={updatePosition}
          remove={deletePosition}
          {...access}
        />
      </TabsContent>

      <TabsContent value="locations">
        <CatalogManager
          noun="Görev yeri"
          items={catalogs.workLocations as CatalogRow[]}
          fields={[NAME, DESCRIPTION, { name: "address", label: "Adres", type: "text" }, SORT]}
          columns={[
            { name: "name", label: "Ad" },
            { name: "address", label: "Adres" },
          ]}
          create={createWorkLocation}
          update={updateWorkLocation}
          remove={deleteWorkLocation}
          {...access}
        />
      </TabsContent>

      <TabsContent value="shifts">
        <CatalogManager
          noun="Vardiya"
          items={catalogs.shifts as CatalogRow[]}
          fields={[
            NAME,
            { name: "startTime", label: "Başlangıç", type: "time", required: true },
            { name: "endTime", label: "Bitiş", type: "time", required: true },
            { name: "color", label: "Renk", type: "color" },
            SORT,
          ]}
          columns={[
            { name: "name", label: "Ad" },
            { name: "startTime", label: "Başlangıç" },
            { name: "endTime", label: "Bitiş" },
          ]}
          create={createShift}
          update={updateShift}
          remove={deleteShift}
          {...access}
        />
      </TabsContent>

      <TabsContent value="roles">
        <CatalogManager
          noun="Rol"
          items={catalogs.staffRoles as CatalogRow[]}
          fields={[
            { name: "key", label: "Anahtar", type: "text", required: true, createOnly: true },
            { name: "label", label: "Etiket", type: "text", required: true },
            { name: "color", label: "Renk", type: "color" },
            SORT,
          ]}
          columns={[
            { name: "key", label: "Anahtar" },
            { name: "label", label: "Etiket" },
            { name: "color", label: "Renk" },
          ]}
          create={createStaffRole}
          update={updateStaffRole}
          remove={deleteStaffRole}
          {...access}
        />
      </TabsContent>
    </Tabs>
  );
}
