export interface IGatewayRequestOptions {
  method?: string;
  endpoint: string;
  body?: any;
  qs?: Record<string, any>;
}

export async function gatewayApiRequest(
  this: any,
  options: IGatewayRequestOptions
): Promise<any> {
  const credentials = await this.getCredentials('whatsAppAiGatewayApi');
  const baseUrl = ((credentials.baseUrl as string) || 'http://localhost:800').replace(/\/+$/, '');
  const apiKey = credentials.apiKey as string;

  let url = `${baseUrl}${options.endpoint.startsWith('/') ? options.endpoint : `/${options.endpoint}`}`;

  if (options.qs && Object.keys(options.qs).length > 0) {
    const query = new URLSearchParams();
    for (const [key, val] of Object.entries(options.qs)) {
      if (val !== undefined && val !== null && val !== '') {
        query.append(key, String(val));
      }
    }
    const queryString = query.toString();
    if (queryString) {
      url += (url.includes('?') ? '&' : '?') + queryString;
    }
  }

  const method = options.method || 'GET';
  const fetchOptions: any = {
    method,
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': apiKey,
    },
  };

  if (method !== 'GET' && method !== 'HEAD' && options.body !== undefined) {
    fetchOptions.body = JSON.stringify(options.body);
  }

  const response = await fetch(url, fetchOptions);
  const data = await response.json().catch(() => ({}));

  if (!response.ok) {
    const errorMsg = data?.error || data?.message || response.statusText || 'Unknown Gateway Error';
    throw new Error(`WhatsApp AI Gateway Error (${response.status}): ${typeof errorMsg === 'object' ? JSON.stringify(errorMsg) : errorMsg}`);
  }

  return data;
}
