import { RoutingContext } from '../routing-context';
import { Parameter } from '../parameter';
import * as Joi from 'joi';

import * as chai from 'chai';
import * as chaiAsPromised from 'chai-as-promised';
chai.use(chaiAsPromised);
const expect = chai.expect;

describe("RoutingContext", () => {
  describe("#validateAndUpdateParams", () => {
    it("should parse and validate JsonBody params", () => {
      const context = new RoutingContext({
        path: "/api/33/followings",
        httpMethod: 'POST',
        body: JSON.stringify({
          update: {
            fieldA: 12345,
            fieldB: 54321,
            fieldC: {
              c: 100,
            }
          }
        }),
        queryStringParameters: {
          testId: "12345",
          not_allowed_param: "xxx",
        }
      } as any, {
        userId: "33"
      });

      context.validateAndUpdateParams({
        testId: Parameter.Query(Joi.number()),
        update: Parameter.Body(Joi.object({
          fieldA: Joi.number(),
          fieldC: Joi.object({
            c: Joi.number()
          })
        })),
        userId: Parameter.Path(Joi.number())
      });

      expect(context.params).to.deep.eq({
        testId: 12345,
        update: {
          fieldA: 12345,
          fieldC: {
            c: 100,
          }
        },
        userId: 33,
      })
    });
  });

  describe("#normalizeHeaders", () => {
    it("should normalize headers", () => {
      const context = new RoutingContext({
        path: "/api/33/followings",
        httpMethod: 'POST',
        body: JSON.stringify({ foo: 'bar' }),
        headers: {
          'origin': 'https://bar.baz',
          'User-Agent': 'Googlebot/1.0',
        },
        queryStringParameters: null,
      } as any, {});

      expect(context.headers).to.be.deep.eq({
        'origin': 'https://bar.baz',
        'user-agent': 'Googlebot/1.0',
      });
    });

    it("should be called lazily / should be cached", () => {
      const context = new RoutingContext({
        path: "/api/wow/awesome",
        httpMethod: 'POST',
        body: JSON.stringify({ such: 'value' }),
        headers: {
          'ETag': 'abcdef',
          'Host': 'www.vingle.net',
        },
        queryStringParameters: null,
      } as any, {});


      // HACK: setup trap for testing call count
      let callCount = 0;
      // backup original function reference
      const fn = (context as any).normalizeHeaders;

      const noop = (() => {}) as any;

      // decorate target method to trap method calls
      (context as any).normalizeHeaders = function () {
        callCount++;
        return fn.apply(context, arguments);
      };

      // normalizeHeaders should be called lazily
      expect(callCount).to.be.eq(0);

      noop(context.headers);
      expect(callCount).to.be.eq(1);

      // ... and should be cached
      noop(context.headers);
      noop(context.headers);
      noop(context.headers);
      expect(callCount).to.be.eq(1);

      expect(context.headers).to.be.deep.eq({
        'etag': 'abcdef',
        'host': 'www.vingle.net',
      });
      expect(callCount).to.be.eq(1);
    });
  });
});
