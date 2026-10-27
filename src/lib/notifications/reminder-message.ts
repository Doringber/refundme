export function reminderEmail(input: {
  title: string;
  body: string;
  url: string;
}): { subject: string; text: string } {
  return {
    subject: input.title,
    text: `${input.body}\n\nלזיכוי: ${input.url}\n`,
  };
}

export function pushPayload(input: {
  title: string;
  body: string;
  url: string;
  tag: string;
}): string {
  return JSON.stringify({
    title: input.title,
    body: input.body,
    url: input.url,
    tag: input.tag,
  });
}
