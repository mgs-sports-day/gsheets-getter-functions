import md5 from 'md5';
import { Dimension } from './types';
import axios from 'axios';

export type ParserFunction<T> = (response: any[][]) => T

type RequestBuilderItem<PreviousValues extends any[], Out> = (values: PreviousValues) => RequestCache<Out> | RequestBuilder<Out> | Out

/**
 * A class to make sure only the necessary requests are reloaded, and everything else is cached.
 *
 * Create an instance of the class, and then use `.add()` to chain new 'steps' to the request. **Each instance of
 * RequestCache needs to have its own step**.
 *
 * Once all steps have been defined, you can call `.run()` to asynchronously execute all steps in order.
 */
export class RequestBuilder<T, NextIn extends any[] = [], NextOut = T> {
    private readonly apiKey: string
    private readonly sheetId: string
    private items: RequestBuilderItem<any, any>[]
    /**
     * Whether to ignore `allowCache = false` and use a cached value regardless.
     * Useful for data that we know will never change (e.g. events list).
     */
    alwaysCache = false
    constructor(apiKey: string, sheetId: string) {
        this.apiKey = apiKey
        this.sheetId = sheetId
        this.items = []
    }

    /**
     * Add a new step to the request. This can either be another `RequestBuilder`, a single request (instance of `RequestCache`)
     * or just a simple synchronous function that returns a value.
     *
     * If using a simple function as the parameter, it gets passed `values` — this is an array containing the results of
     * all previous steps. If a previous step with a `RequestBuilder`/`RequestCache`, it will be the result of the request
     * (after being put through any applicable parser specified in `RequestCache`). If a previous step was a simple function,
     * it will be the value returned by the function.
     *
     * You can use array destructuring to make this easier and more logical. See the example below.
     *
     * @example
     * request.add(([result1, result2]) => {
     *     // do some calculations here
     *     const result3 = result1 + result2
     *     return result3
     * })
     *
     * @param request - The step to add to the `RequestBuilder`
     * @returns The modified `RequestBuilder` instance with the new step added. Calling `.add()` on the returned `RequestBuilder`
     * will allow you to use the output value of the previous step. Note that `.add()` doesn't add to the existing class,
     * but instead returns a new one.
     */
    add<In extends any[] = NextIn, Out = NextOut>(request: RequestBuilderItem<In, Out>) {
        const newRequestBuilder = new RequestBuilder<T, [...In, Out]>(this.apiKey, this.sheetId)
        newRequestBuilder.items = [
            ...this.items,
            request,
        ]
        return newRequestBuilder
    }

    /**
     * Asynchronously execute all steps defined by calls to `.add()`.
     *
     * If any of the steps are `RequestBuilder`s or `RequestCache`s, it will use the cached values where available.
     *
     * If no cached value is available, or `allowCache` is set to false, it will use always use a live value by making a
     * request to the Google Sheets API.
     *
     * If `allowCache` is set to false but one of the steps is a `RequestBuilder` with `alwaysCache = true`, it will
     * attempt to use a cached value anyway.
     *
     * @param allowCache - Whether to allow cached values. If `false`, will ignore cached values and always make requests,
     * except for steps which are a `RequestBuilder` with `alwaysCache = true`.
     * @returns {Promise<T>} - Promise resolving to the specified type `T`
     */
    async run(allowCache = true): Promise<T> {
        const values = []
        for (const item of this.items) {
            const value = item(values)
            if (value instanceof RequestCache) {
                if (allowCache) {
                    values.push(await value.get())
                } else {
                    values.push(await value.live())
                }
            } else if (value instanceof RequestBuilder) {
                values.push(await value.run(allowCache || value.alwaysCache))
            } else {
                values.push(value)
            }
        }

        return values[values.length - 1]
    }
}

export class RequestCache<T> {
    private readonly requestKey: string;
    private readonly url: string;
    private parser?: ParserFunction<T>;

    constructor(apiKey: string, sheetId: string, range: string, dimension: Dimension, isFormatted: boolean) {
        this.url = RequestCache.build(apiKey, sheetId, range, dimension, isFormatted)
        this.requestKey = md5(this.url);
    }

    private static build(apiKey: string, sheetId: string, range: string, dimension: Dimension, isFormatted: boolean) {
        range = encodeURIComponent(range);
        let formatText = isFormatted ? 'FORMATTED_VALUE' : 'UNFORMATTED_VALUE';
        return `https://sheets.googleapis.com/v4/spreadsheets/${sheetId}/values/${range}?majorDimension=${dimension}&valueRenderOption=${formatText}&key=${apiKey}`;
    }

    /**
     * Convert the 2D array from the API into a JSON object, using array[0] as the headers
     * @param {Object} response - The array
     * @returns {Object} - The JSON object
     */
    static twoDimensionParser<T extends []>(response: any[][]): T {
        const headers = response[0];
        const dataset = response.slice(1) as (T[number])[];

        const array = [] as T
        for (const row of dataset) {
            const object = {} as T[number]
            headers.forEach((key, index) => {
                object[key] = row[index]
            })
            array.push(object)
        }

        return array
    }

    setParser(parser: ParserFunction<T>) {
        this.parser = parser
        return this
    }

    parse(response: any[][]): T {
        if (!this.parser) {
            throw new Error("parser not specified")
        }

        return this.parser(response)
    }

    async live(): Promise<T> {
        const response = await axios.get(this.url);
        const parsed = this.parse(response.data.values);
        this.saveCache(parsed);
        return parsed;
    }

    cache(): T {
        const savedValue = this.getCache();
        if (!savedValue) {
            throw new Error('not saved in cache');
        }

        return JSON.parse(savedValue) as T;
    }

    async get(): Promise<T> {
        try {
            return this.cache();
        } catch {
            return this.live();
        }
    }

    private saveCache(value: any) {
        localStorage.setItem(this.requestKey, JSON.stringify(value));
    }

    private getCache() {
        return localStorage.getItem(this.requestKey);
    }
}
