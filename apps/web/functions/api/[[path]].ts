const DEFAULT_API_ORIGIN =
  'https://split-the-bill-api-1099488675893.northamerica-northeast2.run.app'

interface Env {
  API_ORIGIN?: string
}

export const onRequest: PagesFunction<Env> = async (context) => {
  const { request, params, env } = context
  const path = Array.isArray(params.path) ? params.path.join('/') : ''
  const incoming = new URL(request.url)
  const target = new URL(`${env.API_ORIGIN ?? DEFAULT_API_ORIGIN}/${path}`)
  target.search = incoming.search

  const headers = new Headers(request.headers)
  headers.delete('host')

  const init: RequestInit = {
    method: request.method,
    headers,
    redirect: 'manual',
  }

  if (request.method !== 'GET' && request.method !== 'HEAD') {
    init.body = request.body
  }

  return fetch(target.toString(), init)
}
