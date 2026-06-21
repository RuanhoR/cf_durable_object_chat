import { describe, it, expect } from 'vitest'
import ResponseFrame from '../framework'

function makeRequest(method: string, path: string, body?: any): Request {
	return new Request(`http://localhost${path}`, {
		method,
		headers: { 'Content-Type': 'application/json', Origin: 'http://localhost' },
		body: body ? JSON.stringify(body) : undefined,
	})
}

describe('ResponseFrame', () => {
	it('handles simple GET route', async () => {
		const req = makeRequest('GET', '/api/test')
		const frame = new ResponseFrame(req)
		frame.get('/api/test', () => new Response(JSON.stringify({ ok: true }), {
			headers: { 'Content-Type': 'application/json' },
		}))
		const res = await frame.handlerRequest()
		const data = await res.json()
		expect(data).toEqual({ ok: true })
	})

	it('handles POST route with body', async () => {
		const req = makeRequest('POST', '/api/data', { hello: 'world' })
		const frame = new ResponseFrame(req)
		frame.post('/api/data', async (_data, request) => {
			const body = await request.json() as any
			return new Response(JSON.stringify({ echo: body }), {
				headers: { 'Content-Type': 'application/json' },
			})
		})
		const res = await frame.handlerRequest()
		const data = await res.json()
		expect(data).toEqual({ echo: { hello: 'world' } })
	})

	it('returns 404 for unmatched route', async () => {
		const req = makeRequest('GET', '/api/nonexistent')
		const frame = new ResponseFrame(req)
		const res = await frame.handlerRequest()
		expect(res.status).toBe(404)
	})

	it('handles OPTIONS preflight', async () => {
		const req = new Request('http://localhost/api/test', {
			method: 'OPTIONS',
			headers: { Origin: 'http://example.com' },
		})
		const frame = new ResponseFrame(req)
		const res = await frame.handlerRequest()
		expect(res.status).toBe(204)
		expect(res.headers.get('Access-Control-Allow-Origin')).toBe('http://example.com')
	})

	it('passes through middleware chain', async () => {
		const req = makeRequest('GET', '/api/protected')
		const frame = new ResponseFrame(req)
		const log: string[] = []
		frame.use(async (_ctx, next) => {
			log.push('mw1')
			const res = await next()
			log.push('mw1-after')
			return res
		})
		frame.use(async (_ctx, next) => {
			log.push('mw2')
			return next()
		})
		frame.get('/api/protected', () => {
			log.push('handler')
			return new Response(JSON.stringify({ ok: true }), {
				headers: { 'Content-Type': 'application/json' },
			})
		})
		await frame.handlerRequest()
		expect(log).toEqual(['mw1', 'mw2', 'handler', 'mw1-after'])
	})

	it('middleware can short-circuit', async () => {
		const req = makeRequest('GET', '/api/blocked')
		const frame = new ResponseFrame(req)
		frame.use(async () => {
			return new Response(JSON.stringify({ blocked: true }), { status: 401, headers: { 'Content-Type': 'application/json' } })
		})
		frame.get('/api/blocked', () => {
			return new Response(JSON.stringify({ ok: true }), {
				headers: { 'Content-Type': 'application/json' },
			})
		})
		const res = await frame.handlerRequest()
		const data = await res.json()
		expect(data).toEqual({ blocked: true })
		expect(res.status).toBe(401)
	})

	it('middleware with path filter', async () => {
		const req = makeRequest('GET', '/api/foo')
		const frame = new ResponseFrame(req)
		const log: string[] = []
		frame.use(['/api/*'], async (_ctx, next) => {
			log.push('api-mw')
			return next()
		})
		frame.get('/api/foo', () => {
			log.push('handler')
			return new Response('ok', { headers: { 'Content-Type': 'text/plain' } })
		})
		await frame.handlerRequest()
		expect(log).toEqual(['api-mw', 'handler'])
	})
})
