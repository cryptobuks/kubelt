/**
 * @package @kubelt/openrpc
 * @file src/component/index.ts
 */

import * as _ from "lodash";
import * as set from "ts-set-utils";

import type {
  MiddlewareFn,
  MiddlewareResult,
  OpenRpcHandler,
  RpcContext,
  RpcHandler,
  RpcMethod,
  // TODO rename to RpcTable, RpcDispatch, RpcTable?
  RpcMethods,
  RpcRequest,
  RpcResponse,
  RpcSchema,
  Scope,
  ScopeSet,
} from "../index";

import type {
  ParamsObject,
} from "../impl/jsonrpc";

import * as openrpc from "../index";

// Definitions
// -----------------------------------------------------------------------------

// The key used to store a set of field specs on the constructor.
const _FIELDS = "_fields";

// The name of the map that is used to accumulate RPC method descriptors.
const _METHODS = "_rpcMethods";

// Internal field name for set of all scopes declared by the object.
const _SCOPES_ALL = "_allScopes";

// Internal field name for map of method to set of required scopes.
const _SCOPES_REQUIRED = "_requiredScopes";

const _FIELDS_REQUIRED = "_requiredFields";

// Types
// -----------------------------------------------------------------------------

// A map from RPC method name to implementing class method name.
type MethodMap = Map<string, string>;

// The mapping from method name to its required scopes.
type RequiredScopes = Map<Symbol, ScopeSet>;

// The parameters from the JSON-RPC request converted into a Map.
export type RpcParams = Map<string, any>;

// The map of input data passed to an RpcCallable.
export type RpcInput = Map<string, any>;

// The map of output data passed from an RpcCallable.
export type RpcOutput = Map<string, any>;

// The value returned by the RpcCallable and injected into the RpcResponse.
export type RpcResult = any;

// Defines the signature for an OpenRPC handler method defined on a Durable
// Object and which is marked as an @method.
type RpcCallable = (
  // The incoming RPC request.
  params: RpcParams,
  // A map that is used to pass in fields values as configured
  // by @requireField decorations on the called method.
  input: RpcInput,
  // A map that is used to set writable state for fields configured
  // by @requiredField decorations on the called method.
  output: RpcOutput,

  // TODO context values: envvar, secrets, buckets, etc.
  // TODO clients for remote objects/workers

  //context: Map<string, any>,
  //remote: Map<string, any>,
) => RpcResult;

/**
 * Defines a data field that this object manages. These fields may be
 * read or written to if a method has permission (provided by applying
 * the @readState and @writeState decorators.
 */
type ValidatorFn = (x: any) => boolean;

type FieldSpec = {
  // The name of the field.
  name: string;
  // Documentation for the field.
  doc: string;
  // The default value of the field.
  defaultValue: any;
  // The validation function to apply before updating the field.
  //validator: ValidatorFn;
};

export enum FieldAccess {
  Read = "read",
  Write = "write",
};

type FieldName = symbol;

type FieldPerms = Array<FieldAccess>;

type Fields = Map<FieldName, FieldSpec>;

interface RequiredField {
  name: FieldName;
  perms: Set<FieldAccess>;
}

type FieldSet = Set<RequiredField>;

type FieldMap = Map<FieldName, RequiredField>;

type RequiredFields = Map<FieldName, FieldSet>;

type Env = unknown;

// Middleware
// -----------------------------------------------------------------------------
// TODO move these into separate middleware module.

// Check the token including in the request.
function mwAuthenticate(): MiddlewareFn {
  return async (request: Request, context: RpcContext): MiddlewareResult => {
    // TODO check for valid token attached to request
  };
}

// Check that the caller has the required scopes to invoke the requested method.
function mwCheckScopes(scopes: RequiredScopes): MiddlewareFn {
  return async (request: Request, context: RpcContext): MiddlewareResult => {
    // TODO check that the incoming request provides a valid claim for the
    // scopes required by the method that is being invoked.
  };
}

// TODO check required user

// @component
// -----------------------------------------------------------------------------

/**
 * This class decorator is called as a function at runtime with the constructor of
 * the decorated class as its only argument.
 *
 * By returning a value, this class decorator replaces the class declaration with
 * the provided constructor function. NB: by returning a new constructor function
 * we must take care to maintain the original prototype. The logic that applies
 * decorators at runtime does *not* do this for you.
 */
export function component(schema: RpcSchema) {

  return function<T extends { new (...args: any[]): {} }>(constructor: T) {

    // Various decorators are applied to the class, methods, etc. the
    // configuration from which is stored on the class constructor. We
    // retrieve that data and delete the corresponding property as it
    // was only a temporary means of passing data from decorators up to
    // this "top-level" decorator that constructs the class.

    // Collect the component fields (specified using @field decorators
    // on the class) and perform necessary initialization, e.g. set the
    // default values.
    const fields: Fields = Reflect.get(constructor, _FIELDS);
    Reflect.deleteProperty(constructor, _FIELDS);
    //console.log("fields:");
    //console.log(fields);

    // This is the mapping from class method name to the set of
    // component fields that the method requires access to (along with
    // associated permissions, e.g. read, write).
    const fieldsRequired: RequiredFields = Reflect.get(constructor, _FIELDS_REQUIRED);
    Reflect.deleteProperty(constructor, _FIELDS_REQUIRED);
    //console.log("fields required:");
    //console.log(fieldsRequired);

    // This is the mapping from class method name to the set of scopes
    // that are required to invoke the corresponding RPC method.
    const scopesRequired: RequiredScopes = Reflect.get(constructor, _SCOPES_REQUIRED);
    Reflect.deleteProperty(constructor, _SCOPES_REQUIRED);
    //console.log("scopes required:");
    //console.log(scopesRequired);

    // Check that union of required scopes from all methods are
    // contained in the set of scopes defined by @scopes. If the user
    // requires a scope on a method that isn't declared on the class using
    // @scopes, throw an error.
    const allScopes: ScopeSet = Reflect.get(constructor, _SCOPES_ALL);
    Reflect.deleteProperty(constructor, _SCOPES_ALL);
    //console.log("all scopes:");
    //console.log(allScopes);

    // Get the mapping from RPC method name to class method name.
    const rpcMethodMap: MethodMap = Reflect.get(constructor, _METHODS);
    Reflect.deleteProperty(constructor, _METHODS);
    //console.log("rpc method map:");
    //console.log(rpcMethodMap);

    // TODO seal the generated object so that all fields, etc. must be
    // defined declaratively using decorators. Stay out of trouble,
    // friends!

    /**
     * @param {state} a transactional storage API
     * @param {env} any configured bindings
     */
    return class extends constructor implements DurableObject {

      // The schema that this OpenRPC service conforms to.
      private readonly _schema: RpcSchema;

      // A map from method to the set of scopes that it requires to be invoke.
      private readonly _scopes: RequiredScopes;

      // A map from field name (a symbol) to a field descriptor.
      private readonly _fields: Fields;

      // The set of all scopes declared by the component.
      private readonly _allScopes: ScopeSet;

      // Access to Cloudflare transactional storage API.
      private readonly _state: DurableObjectState;

      // The wrangler-configured environment context.
      private readonly _env: Env;

      // A functional OpenRPC request handler. It should be invoked as:
      //   rpcHandler(request: Request, context?: RpcContext);
      // It returns a Response containing a JSON-RPC format response body.
      private readonly _rpcHandler: OpenRpcHandler;

      constructor(...args: any[]) {
        super();

        // TODO Define all these properties to be non-enumerable.
        // There's a proposal for nonenum keyword here:
        //
        //   https://github.com/microsoft/TypeScript/issues/9726
        //
        // but that's likely not happening soon, so prefer
        // Object.defineProperty() for now.
        //
        // TODO decide which of these we need at runtime; don't bother
        // storing anything we don't need.
        this._schema = schema;
        this._scopes = scopesRequired;
        this._fields = fields;
        this._allScopes = allScopes;
        this._state = <DurableObjectState>args[0];
        this._env = <Env>args[1];

        // Ensure that the default values for all fields are stored.
        this._setFieldDefaults();

        // Construct the RPC method handlers that perform pre- and
        // post-setup around invoking the RpcCallables defined on the
        // component class by the user.
        const methods: Array<RpcMethod> = this._initMethods();

        // Construct RPC handler that conforms to the schema, using the
        // supplied methods to implement the defined service methods.
        this._rpcHandler = this.initRPC(schema, methods);
      }

      /**
       *
       */
      private _initMethods() {
        // TODO import type RpcMethodSet for this?
        const methods: Array<RpcMethod> = [];

        // - rpcName: the name of the RPC method
        // - className: the name of the corresponding class method
        for (const [rpcName, className] of rpcMethodMap.entries()) {
          // We use a symbol to identify RPC methods.
          const methodSym = Symbol.for(rpcName);
          const classSym = Symbol.for(className);
          //console.log(`RPC.${methodSym.description} => Class.${classSym.description}`);

          // The scopes required to be able to invoke the RPC method. The returned value
          // is a Set of Symbol values representing the required scope names.
          const scopes: ScopeSet = scopesRequired.get(classSym) || new Set();
          //console.log(scopes);

          const fieldSet: FieldSet = fieldsRequired.get(classSym) || new Set();
          //console.log(fields);

          const fieldMap: FieldMap = new Map();
          for (const field of fieldSet) {
            fieldMap.set(field.name, field);
          }

          // The RPC method implementation on the class. This is what we'll
          // invoke, pass the requested state, context, etc. configured using
          // decorators on the method definition.
          const methodFn: RpcCallable = Reflect.get(this, className);
          //console.log(`methodFn: ${methodFn} (for ${className})`);

          // The handler for the RPC call.
          const handler = openrpc.handler(async (request, context): Promise<RpcResponse> => {
            // TODO check scopes on incoming request, make sure that the required scopes
            // have been granted to the caller. Checked in middleware already?

            // Convert request params into a Map.
            const requestParams: RpcParams = this._prepareParams(request);

            // For each field, if read permission for this method, read
            // the value and store in the map.
            const fieldInput = await this._prepareInput(fieldSet);

            // The map we inject into the RpcCallable to allow the developer to provide
            // output values to save.
            const fieldOutput: RpcOutput = new Map();

            // Invoke the RpcCallable method.
            const requestResult = await methodFn(
              requestParams,
              fieldInput,
              fieldOutput,
            );

            // TODO validate that the returned result conforms to the OpenRPC schema.

            // Keep outputs for which there is write permission and
            // which are valid (conform to their associated schemas).
            const checkedOutput = this._checkOutput(fieldMap, fieldOutput);

            // Write the output values to durable storage.
            await this._storeOutput(fieldSet, checkedOutput);

            return openrpc.response(request, requestResult);
          });
          // Construct a handler for the RPC method.
          const rpcMethod: RpcMethod = openrpc.method(schema, {
            name: rpcName,
            scopes,
            handler,
          });

          methods.push(rpcMethod);
        }
        //console.log("rpc methods:");
        //console.log(methods);

        return methods;
      }

      /**
       * Extract the JSON-RPC request params and return them as a Map.
       */
      private _prepareParams(request: RpcRequest): RpcParams {
        const requestParams: RpcParams = new Map();

        if (_.isArray(request.params)) {
          throw new Error("array params not yet implemented");
        }
        if (_.isPlainObject(request.params)) {
          const params: ParamsObject = request?.params || {};
          for (const paramName in params) {
            const paramValue = params[paramName];
            requestParams.set(paramName, paramValue);
          }
        }

        return requestParams;
      }

      /**
       * Return the set of fields that the user has declared and
       * provided read access to.
       */
      private async _prepareInput(fields: FieldSet): Promise<RpcInput> {
        const fieldInput: RpcInput = new Map();

        console.log(fields);

        // Produce a list of keys to read from storage.
        const readKeys: Array<string> = [];
        for (const field of fields.values()) {
          const fieldName = field.name.description;
          if (fieldName !== undefined) {
            if (field.perms.has(FieldAccess.Read)) {
              // Push the string name of the state to read.
              readKeys.push(fieldName);
            } else {
              console.warn(`tried to read "${fieldName}" without permission; ignored`);
            }
          }
        }

        // Read the values of our list of keys and store the key/value
        // pairs in the RpcInput map.
        const values: Map<string, any> = await this._state.storage.get(readKeys) || new Map();
        for (const [fieldName, fieldValue] of values.entries()) {
          fieldInput.set(fieldName, fieldValue);
        }

        return fieldInput;
      }

      /**
       *
       */
      private _checkOutput(fieldMap: FieldMap, output: RpcOutput): RpcOutput {
        // Drop any outputs that are not declared as required.
        const declared = this._checkOutputDeclared(fieldMap, output);
        // Drop any outputs that there is no write permission for.
        const permitted = this._checkOutputPermitted(fieldMap, declared);

        // TODO validate value to be stored against schema
        // TODO validate value to be stored using provided validator fn
        // TODO return JSON-RPC error if output value doesn't conform?

        return permitted;
      }

      /**
       *
       */
      private _checkOutputDeclared(fields: FieldMap, output: RpcOutput): RpcOutput {
        // Utility to return the keys of a map as a set of symbols.
        function keysToSymbolSet(m: Map<string, any>): Set<Symbol> {
          const s: Set<Symbol> = new Set();
          for (const k of m.keys()) {
            s.add(Symbol.for(k));
          }
          return s;
        }

        // Compute the set of fields that should be updated, i.e. that
        // are marked as required on the RpcCallable method. This is
        // necessary because the developer might set an arbitrary
        // key/value pair in the output map, but we don't want to store
        // anything that hasn't been declared.
        const outputKeys: Set<Symbol> = keysToSymbolSet(output);
        const fieldKeys = new Set(fields.keys());
        const updateKeys = set.intersection(outputKeys, fieldKeys);

        for (const [fieldName, fieldValue] of output.entries()) {
          if (!updateKeys.has(Symbol.for(fieldName))) {
            console.warn(`tried storing output "${fieldName}" without declaration; ignored`);
            output.delete(field.name);
          }
        }

        return output;
      }

      /**
       *
       */
      private _checkOutputPermitted(fields: FieldMap, output: RpcOutput): RpcOutput {
        for (const [fieldName, fieldValue] of output.entries()) {
          const field = fields.get(Symbol.for(fieldName));
          if (field && !field.perms.has(FieldAccess.Write)) {
            const fieldName = field.name.description;
            if (fieldName !== undefined) {
              console.warn(`tried storing output "${fieldName}" without write permission; ignored`);
              output.delete(fieldName);
            }
          }
        }

        return output;
      }

      /**
       * Store the output fields produced by an invocation of an RpcCallable.
       */
      private async _storeOutput(
        fields: FieldSet,
        fieldOutput: RpcOutput,
      ): Promise<any> {
        // Construct an object containing the values to be stored;
        // property names are used as the key name of the value to
        // store.
        interface StorageObject {
          [index: string]: any;
        }
        const entries: StorageObject = {};
        for (const [outName, outValue] of fieldOutput) {
          console.log(`setting field ${outName} => ${outValue}`);
          entries[outName] = outValue;
        }

        return this._state.storage.put(entries);
      }

      /**
       *
       */
      private _setFieldDefaults() {
        // Set the initial values of component fields.
        this._state.blockConcurrencyWhile(async () => {
          // Generate a list of storage promises, one for each field
          // whose default value is being set.
          let wait: Array<Promise<any>> = [];

          this._fields.forEach(async (fieldSpec: FieldSpec) => {
            // Try getting the values first; only set default if the
            // value isn't already defined.
            const value = await this._state.storage.get(fieldSpec.name);
            if (value === undefined) {
              const valueStr = JSON.stringify(fieldSpec.defaultValue);
              console.log(`setting field "${fieldSpec.name}" default to: ${valueStr}`);
              const put: Promise<any> = this._state.storage.put(
                fieldSpec.name,
                fieldSpec.defaultValue,
              );
              wait.push(put);
            } else {
              const valueStr = JSON.stringify(value, null, 2);
              console.log(`found field "${fieldSpec.name}" value: ${valueStr}`);
            }
          });

          // Await all the promises at once; take advantage of write coalescing.
          const values = await Promise.all(wait);
        });
      }

      // TODO extensions define required scopes. Those need to be checked against
      // the set of declared scopes and included in the result of cmp.scopes.

      /**
       *
       */
      initRPC(rpcSchema: RpcSchema, rpcMethods: Array<RpcMethod>): OpenRpcHandler {
        // Defines an "extension" (an RPC method not declared in the
        // schema, but which bundles its own method schema) to return a
        // set of the scopes declared by a component.
        //
        // TODO define require scope(s) to invoke
        // TODO update handler signature to match pure handler impl
        const cmpScopes = openrpc.extension(rpcSchema, {
          schema: {
            name: "cmp.scopes",
            summary: "Return scopes declared by component",
            params: [],
            result: {
              name: "scopes",
              description: "A collection of scopes",
              schema: {
                type: "array",
              },
            },
            errors: [],
          },
          scopes: openrpc.scopes([
            "owner",
          ]),
          handler: openrpc.handler(async (request, context): Promise<RpcResponse> => {
            // Construct the result object describing the available methods and
            // their required scopes. Note that this._methods is an array of RPC method
            // implementations (functions); each has a ._method property (a Symbol) that
            // is the key in the this._scopes map that can be used to look up the scopes
            // required to invoke the method.
            const scopes = [];
            for (const scope of allScopes) {
              scopes.push(scope.description);
            }
            const result = {
              scopes,
            };

            // TODO result doesn't yet include scopes for "extensions", the methods we
            // implement internally.
            return openrpc.response(request, result)
          }),
        });

        // TODO define required scopes(s) to invoke.
        // TODO update handler signature to match pure handler impl
        const cmpDelete = openrpc.extension(rpcSchema, {
          schema: {
            name: "cmp.delete",
            summary: "Delete all component state",
            params: [],
            result: {
              name: "success",
              description: "Was the component successfully deleted",
              schema: {
                type: "boolean",
              },
            },
            errors: [],
          },
          scopes: openrpc.scopes([
            "owner",
          ]),
          handler: openrpc.handler(async (request, context): Promise<RpcResponse> => {
            // Deletes all keys and values, effectively deallocating all storage
            // used by the durable object. NB: If a failure occurs while deletion
            // is in progess, only a subset of the data may be deleted.
            await this._state.storage.deleteAll();
            const result = {
              deleted: true,
            };
            return openrpc.response(request, result)
          }),
        });

        // TODO make this part of graph.@node decorator.
        const graphLink = openrpc.extension(rpcSchema, {
          schema: {
            name: "graph.link",
            summary: "Create a link to another component",
            params: [],
            result: {
              "name": "success",
              schema: {
                type: "boolean",
              },
            },
            errors: [],
          },
          scopes: openrpc.scopes([
            "owner",
          ]),
          handler: openrpc.handler(async (request, context): Promise<RpcResponse> => {
            return openrpc.response(request, { invoked: "graph.link" });
          }),
        });

        // TODO make this part of graph.@node decorator.
        const graphEdges = openrpc.extension(rpcSchema, {
          schema: {
            name: "graph.edges",
            summary: "Return the list of graph edges",
            params: [],
            result: {
              "name": "success",
              schema: {
                type: "boolean",
              },
            },
            errors: [],
          },
          scopes: openrpc.scopes([
            "owner",
          ]),
          handler: openrpc.handler(async (request, context): Promise<RpcResponse> => {
            return openrpc.response(request, { invoked: "graph.edges" });
          }),
        });

        // Supply implementations for all of the API methods in the schema.
        const methods = openrpc.methods(rpcSchema, rpcMethods);

        const extensions = openrpc.extensions(rpcSchema, [
          cmpScopes,
          cmpDelete,
          graphLink,
          graphEdges,
        ]);

        // Configuration options for the API.
        const options = openrpc.options({
          // Enable OpenRPC service discovery.
          rpcDiscover: true,
        });

        const service = openrpc.service(
          rpcSchema,
          allScopes,
          methods,
          extensions,
          options,
        );

        //
        // Handler
        //

        const basePath = "/";

        const rootPath = "/openrpc";

        // Construct a sequence of middleware to execute.
        //
        // NB: rpc.discover is built-in to the OpenRPC library
        // because it's a standard part of that protocol. These
        // methods are implemented here as extensions to support
        // an RPC component-based model of interaction with DOs.
        const chain = openrpc.chain([
          // Authenticate using a JWT in the request.
          mwAuthenticate(),
          // Preflight check that supplied claims fulfill required scopes.
          mwCheckScopes(this._scopes),
        ]);

        // The returned handler validates the incoming request, routes it to the
        // correct method handler, and executes the handler on the request to
        // generate the response.
        return openrpc.build(
          service,
          basePath,
          rootPath,
          chain,
        );
      }

      // Workers communicate with a Durable Object via the Fetch API. Like a
      // Worker, a Durable Object listens for incoming Fetch events by
      // registering this event handler.
      //
      // NB: A Worker can pass information to a Durable Object via headers,
      // the HTTP method, the Request body, or the Request URI.
      async fetch(request: Request) {
        // const ip: string = request.headers.get("CF-Connecting-IP") || "0.0.0.0";
        // const data: string = await request.text();
        // const storagePromise = this.state.storage.put(ip, data);
        // await storagePromise;

        // TODO define context based on configured decorators? e.g.
        // - @rpcSecret: adds a secret to the context
        // - @rpcBucket: adds an R2 bucket to the context
        // - @rpcKV: adds a KV store to the context
        // etc.
        const context = openrpc.context();

        return await this._rpcHandler(request, context);
      }

    }
  }
}

// @scopes
// -----------------------------------------------------------------------------

/**
 * Defines the collection of scopes exposed by the object. For example, a
 * state management object might expose scopes that allow any data to be
 * read or written. A service object providing computational services
 * might require "execute" scope, etc.
 *
 * Individual methods and fields may protect their invocation or access
 * with any of these scopes by using an appropriate decorator.
 */
export function scopes(scopes: Array<string>) {

  // Turn each scope string into a Symbol.
  const scopeSet: ScopeSet = new Set(
    scopes.map(scope => {
      return Symbol.for(scope.trim().toLowerCase());
    })
  );

  return function<T extends { new (...args: any[]): {} }>(constructor: T) {
    // Define this property so as to be read-only and non-enumerable, i.e. it
    // won't show up if the user should iterate over the keys of the target.
    // NB: we define the property on the constructor and not the prototype
    // because we are simply passing these values to the @rpcObject context for
    // use in initializing the durable object instance.
    Object.defineProperty(constructor, _SCOPES_ALL, {
      value: scopeSet,
      enumerable: false,
      writable: false,
    });

    return constructor;
  }
}

// @field
// -----------------------------------------------------------------------------

export function field(fieldSpec: FieldSpec) {

  // TODO get collection of fields defined so far
  // TODO check that current field name doesn't conflict with existing fields
  // TODO add field spec to the set
  // TODO (component): store collection of all defined fields

  return function<T extends { new (...args: any[]): {} }>(constructor: T) {

    const fieldName = Symbol.for(fieldSpec.name.trim());
    const fields = Reflect.get(constructor, _FIELDS) || new Map<Symbol, FieldSpec>();
    fields.set(fieldName, fieldSpec);

    Reflect.set(constructor, _FIELDS, fields);
  }
}

// @method
// -----------------------------------------------------------------------------

/**
 * Marks a method as being the implementation of a particular OpenRPC schema method.
 *
 * @param schemaMethod the name of the schema method the decorated class
 * method implements.
 */
export function method(schemaMethod: string) {
  // - target: class constructor function for static member OR the
  //   prototype of the class for an instance member
  // - propertyKey: the name of the member
  // - descriptor: a Property Descriptor for the method
  //
  // NB: If a method decorator returns a value it is used as the property
  // descriptor for the method.

  return function (
    // TODO better type here
    target: any,
    methodName: string,
    descriptor: PropertyDescriptor,
  ) {
    // Record mapping from schemaMethod (the RPC method name as defined
    // in the schema) to the methodName (the name of the RpcCallble method
    // defined on the class, of type RpcCallable).
    //
    // Use this in @component to build the method map.

    const methods: MethodMap = Reflect.has(target.constructor, _METHODS) ?
      Reflect.get(target.constructor, _METHODS) :
      new Map<string, string>()
    ;
    methods.set(schemaMethod, methodName);

    Reflect.set(target.constructor, _METHODS, methods);
  };
}

// @requiredScope
// -----------------------------------------------------------------------------

/**
 * This decorator is applied to a class method to declare a scope that
 * the user must have in order to invoke the RPC method implemented by the
 * method. Any such scope must have been declared at the class level using
 * the @scopes decorator or an error is thrown on construction.
 */
export function requiredScope(scope: string | Symbol) {
  //console.log("factory: @requiredScope");

  // The decorator argument is the name of a scope declared on the class.
  //
  // NB: We may want to support passing in an array of scopes.
  const scopeSym: Symbol = (typeof(scope) === "string") ?
    Symbol.for(scope.trim().toLowerCase()) :
    scope
  ;

  // This creates or updates a class member that contains the
  // required scopes for every method that is decorated. The constant
  // _SCOPES_REQUIRED provides the name of that value. We read the current
  // set of defined scopes for the method (or create an empty set if none
  // have yet been defined) and then add the required scope to the set before
  // storing the result.

  // TODO define _SCOPES_REQUIRED property with Object.defineProperty()
  // and make it non-enumerable (since it's an internal implementation detail).
  function getRequiredScopes(target: any): RequiredScopes {
    // TODO use a better type for target.
    return Reflect.get(target.constructor, _SCOPES_REQUIRED) || new Map();
  }

  // Take a map of required scopes for all methods, and add the declared
  // scope to the set of scopes required by the method with the given name.
  function addMethodScope(requiredScopes: RequiredScopes, fieldName: string): RequiredScopes {
    // We use symbols as map keys and set elements where possible.
    const fieldSym = Symbol.for(fieldName);

    // Get the current set of scopes for the method and add the new scope to the set.
    const currentScopes: ScopeSet = requiredScopes.get(fieldSym) || new Set();
    const updatedScopes: ScopeSet = currentScopes.add(scopeSym);

    // Store the updated set of scopes for the method.
    requiredScopes.set(fieldSym, updatedScopes);

    return requiredScopes;
  }

  // Store the map of required scopes on the target constructor, which
  // we use as implicit context for passing data between decorators.
  function setRequiredScopes(target: any, requiredScopes: RequiredScopes) {
    // TODO better argument type for target
    Reflect.set(target.constructor, _SCOPES_REQUIRED, requiredScopes);
  }

  return function (
    // TODO better type here
    target: any,
    propertyKey: string,
    descriptor: PropertyDescriptor,
  ) {
    // This is a map from method name into a set of its required scopes.
    const requiredScopes: RequiredScopes = getRequiredScopes(target);

    // Add the provided scope to the set of required scopes for the
    // method that the decorator was applied to.
    const updatedScopes = addMethodScope(requiredScopes, propertyKey);

    // Pass the whole map along so that it can be updated in another
    // usage of the @requiredScope decorator or used by the @rpbObject
    // decorator.
    setRequiredScopes(target, updatedScopes);
  }
}

// @requiredField
// -----------------------------------------------------------------------------

export function requiredField(name: string, perms: FieldPerms) {

  const fieldName = Symbol.for(name.trim());

  const fieldPerms = new Set(perms);

  function getRequiredFields(target: any): RequiredFields {
    // TODO use a better type for target.
    return Reflect.get(target.constructor, _FIELDS_REQUIRED) || new Map();
  }

  function addMethodField(
    requiredFields: RequiredFields,
    methodName: symbol,
    reqField: RequiredField,
  ): RequiredFields {
    const currentFields: FieldSet = requiredFields.get(methodName) || new Set();
    const updatedFields: FieldSet = currentFields.add(reqField);
    return requiredFields.set(methodName, updatedFields);
  }

  function setRequiredFields(target: any, requiredFields: RequiredFields) {
    // TODO Better type for target.
    Reflect.set(target.constructor, _FIELDS_REQUIRED, requiredFields);
  }

  return function (
    // TODO better type here
    target: any,
    propertyKey: string,
    descriptor: PropertyDescriptor,
  ) {
    const methodName = Symbol.for(propertyKey);
    // A map from method name to the fields that it requires.
    const requiredFields: RequiredFields = getRequiredFields(target);
    const updatedFields = addMethodField(requiredFields, methodName, {
      name: fieldName,
      perms: fieldPerms,
    });
    setRequiredFields(target, updatedFields);
  }
}

// requiredEnvironment
// -----------------------------------------------------------------------------

/**
 * Injects an environment variable.
 */
function requiredEnvironment(name: string) {
  console.log("factory: requiredEnvironment");
  return function (target: any, propertyKey: string, descriptor: PropertyDescriptor) {
    console.log("requiredEnvironment");
  }
}

// requiredSecret
// -----------------------------------------------------------------------------

/**
 * Injects a secret value.
 */
function requiredSecret(name: string) {
  console.log("factory: requiredSecret");
  return function (target: any, propertyKey: string, descriptor: PropertyDescriptor) {
    console.log("requiredSecret");
  }
}

// requiredRemote
// -----------------------------------------------------------------------------
// TODO Add another superclass that implements generic graph
// interface. Extend RPC schema with standard collection of graph-related
// methods that are included in the rpc.discover output.
// - node.link - create an edge to another object

// TODO inject an RPC client for each remote object type that user indicates they require.
// Or perhaps this should be more tightly linked to graph metaphor?
function requiredRemote() {
  console.log("factory: requiredRemote");
  return function (target: any, propertyKey: string, descriptor: PropertyDescriptor) {
    console.log("requiredRemote");
  }
}
