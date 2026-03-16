declare module 'parquetjs-lite' {
    export type ParquetRow = object;
    export type ParquetSchemaDefinition = Record<string, { type: string }>;
    export class ParquetSchema {
        constructor(schema: ParquetSchemaDefinition);
    }
    export class ParquetWriter<Row extends ParquetRow = ParquetRow> {
        static openFile<Row extends ParquetRow = ParquetRow>(schema: ParquetSchema, path: string): Promise<ParquetWriter<Row>>;
        appendRow(row: Row): Promise<void>;
        close(): Promise<void>;
    }
    export class ParquetReader {
        static openFile(path: string): Promise<ParquetReader>;
        getCursor<Row extends ParquetRow = ParquetRow>(): ParquetCursor<Row>;
        close(): Promise<void>;
    }
    export class ParquetCursor<Row extends ParquetRow = ParquetRow> {
        next(): Promise<Row | null>;
    }
}
