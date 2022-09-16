import { 
    redirect 
  } from "@remix-run/cloudflare";

type HeadersObject = {
    // "Access-Control-Allow-Origin": string,
    "Content-Type": string,
    "KBT-Access-JWT-Assertion"?: string,
    "Cookie"?: string,
}

type OortOptions = {
    address?: string;
    jwt?: string;
    cookie?: string;
}

// TODO: REMOVE ADDRESS PARAM
// TODO: ERROR HANDLING
// TODO: PICK WINNER FOR AUTH (JWT OR COOKIE)
export async function oortSend(method: string, params: any[], options: OortOptions) {
    const id = method.replace(/^.+_/,'').replace(/[A-Z]/g, m => "-" + m.toLowerCase())

    const headers: HeadersObject = {
        // "Access-Control-Allow-Origin": "*",
        'Content-Type': 'application/json;charset=UTF-8',
    }
    if (options.jwt) {
        headers['KBT-Access-JWT-Assertion'] = options.jwt;
    }
    if (options.cookie) {
        headers['Cookie'] = options.cookie;
    }

    //@ts-ignore
    const response = await fetch(`${OORT_SCHEMA}://${OORT_HOST}${options.address ? `/@${options.address}` : ''}/jsonrpc`, {
        method: "POST",
        headers,
        body: JSON.stringify({
            id,
            jsonrpc: "2.0",
            method,
            params,
        }),
    });

    const json = await response.json();
    return json;
}