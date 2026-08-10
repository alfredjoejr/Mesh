export const generateKeyPair = async () => {
  const keyPair = await window.crypto.subtle.generateKey(
    {
      name: "RSA-OAEP",
      modulusLength: 2048,
      publicExponent: new Uint8Array([1, 0, 1]),
      hash: "SHA-256",
    },
    true,
    ["encrypt", "decrypt"]
  );
  return keyPair;
};

export const exportKey = async (key: CryptoKey) => {
  const exported = await window.crypto.subtle.exportKey("jwk", key);
  return JSON.stringify(exported);
};

export const importPublicKey = async (jwkString: string) => {
  const jwk = JSON.parse(jwkString);
  return await window.crypto.subtle.importKey(
    "jwk",
    jwk,
    {
      name: "RSA-OAEP",
      hash: "SHA-256",
    },
    true,
    ["encrypt"]
  );
};

export const importPrivateKey = async (jwkString: string) => {
  const jwk = JSON.parse(jwkString);
  return await window.crypto.subtle.importKey(
    "jwk",
    jwk,
    {
      name: "RSA-OAEP",
      hash: "SHA-256",
    },
    true,
    ["decrypt"]
  );
};

const arrayBufferToBase64 = (buffer: ArrayBuffer) => {
  let binary = '';
  const bytes = new Uint8Array(buffer);
  for (let i = 0; i < bytes.byteLength; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return window.btoa(binary);
};

const base64ToArrayBuffer = (base64: string) => {
  const binary_string = window.atob(base64);
  const len = binary_string.length;
  const bytes = new Uint8Array(len);
  for (let i = 0; i < len; i++) {
    bytes[i] = binary_string.charCodeAt(i);
  }
  return bytes.buffer;
};

export const encryptMessage = async (text: string, receiverPubKeyJwk: string, senderPubKeyJwk: string) => {
  const encoder = new TextEncoder();
  const data = encoder.encode(text);

  const aesKey = await window.crypto.subtle.generateKey(
    { name: "AES-GCM", length: 256 },
    true,
    ["encrypt", "decrypt"]
  );

  const iv = window.crypto.getRandomValues(new Uint8Array(12));
  const ciphertext = await window.crypto.subtle.encrypt(
    { name: "AES-GCM", iv: iv },
    aesKey,
    data
  );

  const rawAesKey = await window.crypto.subtle.exportKey("raw", aesKey);

  const receiverPubKey = await importPublicKey(receiverPubKeyJwk);
  const senderPubKey = await importPublicKey(senderPubKeyJwk);

  const encKeyReceiver = await window.crypto.subtle.encrypt({ name: "RSA-OAEP" }, receiverPubKey, rawAesKey);
  const encKeySender = await window.crypto.subtle.encrypt({ name: "RSA-OAEP" }, senderPubKey, rawAesKey);

  return JSON.stringify({
    iv: arrayBufferToBase64(iv),
    ciphertext: arrayBufferToBase64(ciphertext),
    encKeyReceiver: arrayBufferToBase64(encKeyReceiver),
    encKeySender: arrayBufferToBase64(encKeySender)
  });
};

export const decryptMessage = async (payloadStr: string, privateKeyJwk: string, isReceiver: boolean) => {
  try {
    const payload = JSON.parse(payloadStr);
    if (!payload.iv || !payload.ciphertext || !payload.encKeyReceiver || !payload.encKeySender) {
      return payloadStr; // Legacy unencrypted message
    }

    const privateKey = await importPrivateKey(privateKeyJwk);
    const encKeyStr = isReceiver ? payload.encKeyReceiver : payload.encKeySender;
    const encKeyBuf = base64ToArrayBuffer(encKeyStr);

    const rawAesKey = await window.crypto.subtle.decrypt({ name: "RSA-OAEP" }, privateKey, encKeyBuf);
    
    const aesKey = await window.crypto.subtle.importKey(
      "raw",
      rawAesKey,
      { name: "AES-GCM" },
      true,
      ["decrypt"]
    );

    const decrypted = await window.crypto.subtle.decrypt(
      { name: "AES-GCM", iv: base64ToArrayBuffer(payload.iv) },
      aesKey,
      base64ToArrayBuffer(payload.ciphertext)
    );

    const decoder = new TextDecoder();
    return decoder.decode(decrypted);
  } catch (e) {
    console.error("Decryption failed", e);
    return "🔒 [Encrypted Message - Decryption Failed]";
  }
};
