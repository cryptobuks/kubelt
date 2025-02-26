---
title: "3ID Quick Start"
description: ""
lead: ""
date: 2020-11-16T13:59:39+01:00
lastmod: 2020-11-16T13:59:39+01:00
draft: false
images: []
menu:
  docs:
    parent: "3id"
weight: 700
toc: true
---

### 3iD Profile Request

To request a user's 3iD profile simply construct a [JSON RPC](https://www.jsonrpc.org/) request using the user's wallet account address with the `kb_getProfile` method. For example:

**Request**
```
POST https://3id.kubelt.com/<wallet address>/jsonrpc
{
  "id": 1,
  "jsonrpc": "2.0",
  "method": "kb_getProfile",
  "params": []
}
```

**Response**
```
{
    "jsonrpc": "2.0",
    "id": "fcfc0fce-a252-4845-ae60-7a15c9b7d560",
    "result": {
        "nickname": "dall-e",
        "email": "dalle@kubelt.com",
        "bio": "Working on 3ID @ Kubelt.",
        "website": "https://threeid.xyz",
        "location": "Toronto",
        "job": "AI Engineer"
        "profilePicture": {
            "collectionTokenId": "0x0000000000000000000000000000000000000000000000000000000000000000",
            "collectionId": "My Collection",
            "name": "DALL-E Generated PFP",
            "imageUrl": "data:image/jpeg;base64,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:image/svg+xml;base64,PHN2ZyB2aWV3Qm94PSIwIDAgMjU1IDI1NSIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj48ZyBjbGFzcz0iRE4iIHRyYW5zZm9ybT0ic2NhbGUoNi4wNDc2MSkgdHJhbnNsYXRlKDEwNi41MDAsMTEzLjUwMCkiIHRyYW5zZm9ybS1vcmlnaW49ImNlbnRlciBjZW50ZXIiPjxwYXRoIHN0cm9rZT0iIzM2MzYzNiIgZD0iTTE1IDBoMU0xNiAyaDFNMTYgM2gxTTE2IDRoMU0xNiA1aDFNMTUgNmgyTTEzIDdoMjEiLz48cGF0aCBzdHJva2U9IiM5Njk2OTYiIGQ9Ik0xNiAwaDE0TTE2IDFoMTRNMTcgMmgxM00xNyAzaDEzTTE3IDRoMTNNMTcgNWgxM00xNyA2aDEzTTExIDhoMjNNMTEgOWgyMyIvPjxwYXRoIHN0cm9rZT0iIzQ1NDU0NSIgZD0iTTE1IDFoMU0xNSAyaDFNMTUgM2gxTTE1IDRoMU0xNSA1aDFNMTEgN2gyIi8+PHBhdGggc3Ryb2tlPSIjMDAwIiBkPSJNNSA3aDNNNSA4aDRNNSA5aDVNMzUgOWgyTTMgMTBoN00zNCAxMGg0TTMgMTFoNE0yNyAxMWg0TTM0IDExaDVNMiAxMmg0TTI1IDEyaDNNMzQgMTJoNU0yIDEzaDNNMTUgMTNoNU0yMyAxM2gzTTM1IDEzaDVNMSAxNGg0TTE5IDE0aDVNMjcgMTRoMU0zOCAxNGgyTTEgMTVoM00yMSAxNWgyTTI2IDE1aDJNMzggMTVoM00wIDE2aDRNMjAgMTZoMk0zOSAxNmgyTTAgMTdoNE0zOSAxN2gyTTEgMThoNE0zOSAxOGgzTTEgMTloNk0zOSAxOWgzTTIgMjBoN00zNyAyMGg1TTMgMjFoMTFNMzEgMjFoMTFNNSAyMmg5TTMxIDIyaDEwTTcgMjNoN00zMSAyM2g5Ii8+PHBhdGggc3Ryb2tlPSIjMjI0NzVjIiBkPSJNMTUgMTBoMU0zMCAxMGgxTTE1IDExaDFNMTQgMTJoMU0zMSAxM2gxTTEzIDE0aDFNMzEgMTRoMU0xMyAxNWgxTTMxIDE1aDFNMTMgMTZoMU0zMSAxNmgxTTE0IDIwaDFNMzAgMjBoMU0xNCAyMWgxTTE0IDIyaDFNMzAgMjJoMU0xNSAyM2gxTTI4IDIzaDFNMTUgMjRoMU0yNiAyNmgxTTE3IDI3aDFNMTggMjhoMk0yMSAyOGgxTTIzIDI4aDQiLz48cGF0aCBzdHJva2U9IiM1ZmNkZTQiIGQ9Ik0xNiAxMGg0TTIxIDEwaDFNMjQgMTBoMU0yNiAxMGgxTTE3IDExaDRNMjIgMTFoNE0xNSAxMmgyTTE4IDEyaDdNMjggMTJoMk0yMCAxM2gzTTI5IDEzaDFNMTUgMTRoMk0yOCAxNGgyTTE2IDE1aDFNMjMgMTVoMk0yOCAxNWgyTTE1IDE2aDNNMjIgMTZoOE0xNSAxN2gxNU0xNSAxOGgxNU0xNiAxOWgxNE0xNyAyMGgxM00xNiAyMWgxTTE4IDIxaDExTTE3IDIyaDNNMjUgMjJoNE0xOCAyM2gxTTI1IDIzaDJNMTkgMjRoMk0yNiAyNGgxTTE1IDI1aDFNMTggMjVoMU0yMCAyNWgyTTI0IDI1aDFNMjcgMjVoMU0xNiAyNmgxTTE5IDI2aDJNMjQgMjZoMU0yMCAyN2gxTTIyIDI3aDEiLz48cGF0aCBzdHJva2U9IiNiM2RiZTMiIGQ9Ik0yMCAxMGgxTTIyIDEwaDJNMjcgMTBoMk0xNCAxMWgxTTE2IDExaDFNMjEgMTFoMU0xNyAxMmgxTTMwIDEyaDJNMTMgMTNoMk0xMyAxOGgxTTE0IDE5aDFNMzAgMTloMU0zMSAyMGgxTTE1IDIyaDFNMjkgMjJoMU0xNCAyM2gxTTE2IDIzaDFNMjcgMjNoMU0xNiAyNGgxTTE3IDI1aDFNMjIgMjVoMk0xNyAyNmgxTTIxIDI2aDJNMjEgMjdoMSIvPjxwYXRoIHN0cm9rZT0iIzU1YzBiMiIgZD0iTTI1IDEwaDFNMjYgMTFoMU0xNCAxNGgxTTE0IDE1aDJNMzAgMTZoMU0zMCAxN2gxTTE0IDE4aDFNMzAgMThoMU0xNSAxOWgxTTE1IDIwaDJNMTUgMjFoMU0xNyAyMWgxTTE2IDIyaDFNMjUgMjRoMU0yNyAyNGgxTTE5IDI1aDFNMjYgMjVoMU0yMyAyNmgxIi8+PHBhdGggc3Ryb2tlPSIjMmU3YzY5IiBkPSJNMjkgMTBoMU0xNyAyM2gxTTI1IDI1aDFNMTggMjZoMU0yNSAyNmgxTTI3IDI2aDFNMTggMjdo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",
        },
        "socials": {
            "twitter": "https://twitter.com/OpenAI",
            "github": "https://github.com/openai"
        }
    }
}
```

### 3iD Profile RPC Methods

The getter and setter methods are:

- `kb_getProfile`
- `kb_setProfile`

### Authorization Model

While the `kb_getProfile` method is publicly available, calling the `kb_setProfile` method requires authorization. [See the Authorization Guide]({{< relref "starport" >}}) for more information on Kubelt's authorization model.

### 3iD Profile Data Shape

3iD-specific profile data follows this schema (in TypeScript but without loss of generality):

```typescript
export interface Profile {
  nickname?: string;
  profilePicture?: {
    collectionTokenId: string;
    collectionId?: string;
    name: string;
    imageUrl: string;
  };
  email?: string;
  location?: string;
  job?: string;
  website?: string;
  bio?: string;
  socials?: {
    twitter?: string;
    instagram?: string;
    linkedin?: string;
    github?: string;
  };
```

### Custom User Data

Using 3iD means you don't have to worry about storing user data -- your users can store it themselves!

In order to store your own custom application data within a user's 3iD profile you will need to use a custom application namespace as well as our new encrypted storage RPC methods. [Join our Discord](https://discord.gg/UgwAsJf6C5) to talk to us about your use case and get beta access.

### FAQ

Joining our [Discord →](https://discord.gg/UgwAsJf6C5) is the fastest way to get your question answered.
