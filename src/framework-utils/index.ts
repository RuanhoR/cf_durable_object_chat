import { JSTypes } from "../types";

export function json(json: object, status?: number) {
	return new Response(JSON.stringify(json), {
		headers: {
			"Content-type": "application/json; charset=utf-8"
		},
		status: status || 200
	})
}

export type TypeMap = {
	string: string;
	number: number;
	boolean: boolean;
	object: object;
	function: Function;
	symbol: symbol;
	undefined: undefined;
	bigint: bigint;
};

export function verifyType<T extends Record<string, keyof TypeMap>>(
	obj: any,
	verify: T
): obj is { [K in keyof T]: TypeMap[T[K]] } {
	return Object.entries(verify).every(([key, type]) => {
		return typeof obj[key] === type;
	});
}
