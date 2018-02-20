import { Presenter } from "./presenter";

import { ClassValidator, ClassValidatorJSONSchema } from "./class_validator";

function getPropType(target: any, property: string) {
  return Reflect.getMetadata('design:type', target, property);
}

export class EntityPresenterFactory {
  private static __schemas: any;
  public static schemas() {
    if (!this.__schemas) {
      const metadatas = (ClassValidator.getFromContainer(ClassValidator.MetadataStorage) as any).validationMetadatas;

      const wiringRequiredSchemas: any[] = [];
      const schemas = ClassValidatorJSONSchema.validationMetadatasToSchemas(metadatas, {
        additionalConverters: {
          [ClassValidator.ValidationTypes.CUSTOM_VALIDATION]: (meta) => {
            if (meta.constraintCls === ClassValidator.ValidateEntityArray) {
              const [ elementClass ] = meta.constraints;

              if (!elementClass) {
                throw new Error("ValidateNestedElement requires elementClass parameter");
              }

              console.log(elementClass, Object.prototype.toString.call(elementClass));

              const schema = {
                type: "array",
              };

              wiringRequiredSchemas.push(schema);

              return Object.defineProperty(schema, "__elementClass", {
                value: elementClass,
              });
            } else {
              throw new Error("EntityPresenterFactory doesn't support custom validator");
            }
          },
        }
      });

      wiringRequiredSchemas.forEach((schema) => {
        const elementModelName = schema.__elementClass.name;
        const elementSchema = schemas[elementModelName];

        if (!elementSchema) {
          throw new Error(`${elementModelName} must be decorated with ClassValidator`);
        }

        schema.items = {
          "$ref": `#/definitions/${elementModelName}`,
        };
      });

      this.__schemas = schemas;
    }
    return this.__schemas;
  }

  private static outputJSONSchemaMap = new Map<any, any>();

  public static create<Model, Entity>(outputClass: { new(): Entity }, presentMethod: (input: Model) => Promise<Entity> | Entity) {
    const presenter: Presenter<Model, Entity> = {
      outputJSONSchema: () => {
        const modelName = outputClass.name;
        let schema = this.outputJSONSchemaMap.get(modelName);
        if (!schema) {
          schema = this.schemas()[modelName];
          if (!schema) {
            throw new Error(`${modelName} must be decorated with ClassValidator`);
          }
          // Make sure there IS schema, and convert back to Reference
          schema = {
            "$ref": `#/definitions/${modelName}`
          };

          this.outputJSONSchemaMap.set(modelName, schema);
        }
        return schema;
      },
      present: presentMethod,
    };
    return presenter;
  }

  public static createArray<Model, Entity>(outputClass: { new(): Entity }, presentMethod: (input: Model) => Promise<Entity[]> | Entity[]) {
    const presenter: Presenter<Model, Entity[]> = {
      outputJSONSchema: () => {
        const modelName = outputClass.name;
        const storeName = `${modelName}List`;
        let schema = this.outputJSONSchemaMap.get(storeName);
        if (!schema) {
          schema = this.schemas()[modelName];
          if (!schema) {
            throw new Error(`${modelName} must be decorated with ClassValidator`);
          }
          // Make sure there IS schema, and convert back to Reference
          schema = {
            "$ref": `#/definitions/${modelName}`
          };
          schema = {
            "type": "array",
            "items": schema,
          };
          this.outputJSONSchemaMap.set(storeName, schema);
        }
        return schema;
      },
      present: presentMethod,
    };
    return presenter;
  }
}