import { GraphQLYogaError } from "@graphql-yoga/common";

import { OortJwt } from "../clients/oort";

export function parseJwt(token: string): OortJwt {
  var base64Url = token.split(".")[1];
  var base64 = base64Url.replace(/-/g, "+").replace(/_/g, "/");
  var jsonPayload = decodeURIComponent(
    atob(base64)
      .split("")
      .map(function (c) {
        return "%" + ("00" + c.charCodeAt(0).toString(16)).slice(-2);
      })
      .join("")
  );

  return JSON.parse(jsonPayload);
}

export const setupContext = () => (next) => (root, args, context, info) => {
  const jwt = context.request.headers.get("KBT-Access-JWT-Assertion");
  const parsedJwt = jwt && parseJwt(jwt);
  const coreId = parsedJwt && parsedJwt.iss;
  return next(root, args, { ...context, jwt, coreId }, info);
};

export const isAuthorized = () => (next) => (root, args, context, info) => {
  // TODO: update to check if user is authorized too with authorzation header
  if (!context.jwt) {
    throw new Error("You are not authenticated!");
  }

  return next(root, args, context, info);
};

export async function checkHTTPStatus(response: Response) {
  if (response.status !== 200) {
    const json: { error: string } = await response.json();
    throw new GraphQLYogaError(
      `Error: ${response.status} ${response.statusText}: ${json.error}`
    );
  }
}

export async function getRPCResult(response: Response) {
  const json: {
    error?: { message: string; code: string };
    result?: { value: any };
  } = await response.json();
  if (json.error) {
    throw new GraphQLYogaError(
      `Error: ${json.error?.code} ${json.error?.message}`
    );
  }
  return json.result?.value;
}
