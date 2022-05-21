import md5 from 'md5';
import { Dimension } from './types';
import axios from 'axios';

export type ParserFunction<T> = (response: any[][]) => T

type RequestBuilderItem<PreviousValues extends any[], Out> = (values: PreviousValues) => RequestCache<Out> | RequestBuilder<Out> | Out
export class RequestBuilder<T, NextIn extends any[] = [], NextOut = T> {
    private readonly apiKey: string
    private readonly sheetId: string
    private items: RequestBuilderItem<any, any>[]
    /**
     * Whether to ignore allowCache = false and use a cached value regardless.
     * Useful for data that we know will never change (e.g. events list).
     */
    alwaysCache = false
    constructor(apiKey: string, sheetId: string) {
        this.apiKey = apiKey
        this.sheetId = sheetId
        this.items = []
    }

    add<In extends any[] = NextIn, Out = NextOut>(request: RequestBuilderItem<In, Out>) {
        const newRequestBuilder = new RequestBuilder<T, [...In, Out]>(this.apiKey, this.sheetId)
        newRequestBuilder.items = [
            ...this.items,
            request,
        ]
        return newRequestBuilder
    }

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
