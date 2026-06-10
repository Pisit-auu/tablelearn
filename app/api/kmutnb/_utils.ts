import { gunzipSync } from "zlib";

export const apiBase = "https://reg1.kmutnb.ac.th/regapiweb2/api/th";
export const tokenUrl = `${apiBase}/Validate/tokenservice`;
const maxBase64ResultLength = 5 * 1024 * 1024;
const maxJsonOutputLength = 10 * 1024 * 1024;

export async function getToken() {
  const tokenResponse = await fetch(tokenUrl, { cache: "no-store" });

  if (!tokenResponse.ok) {
    throw new Error("ไม่สามารถขอ token จากระบบทะเบียนได้");
  }

  const tokenData = (await tokenResponse.json()) as { token?: string };

  if (!tokenData.token) {
    throw new Error("ระบบทะเบียนไม่ส่ง token กลับมา");
  }

  return tokenData.token;
}

export async function fetchCompressedJson<T>(path: string, token: string) {
  const response = await fetch(`${apiBase}/${path}`, {
    cache: "no-store",
    headers: {
      Authorization: `Bearer ${token}`,
    },
  });

  if (!response.ok) {
    throw new Error("ไม่สามารถดึงข้อมูลจากระบบทะเบียนได้");
  }

  const data = (await response.json()) as { result?: string };

  if (!data.result) {
    throw new Error("ระบบทะเบียนไม่ส่งข้อมูลกลับมา");
  }

  if (data.result.length > maxBase64ResultLength) {
    throw new Error("ข้อมูลจากระบบทะเบียนมีขนาดใหญ่เกินไป");
  }

  const json = gunzipSync(Buffer.from(data.result, "base64"), {
    maxOutputLength: maxJsonOutputLength,
  }).toString("utf8");

  return JSON.parse(json) as T;
}
