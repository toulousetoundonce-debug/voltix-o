export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

export default function OpenGraphImage() {
  return new Response(
    Buffer.from(
      "iVBORw0KGgoAAAANSUhEUgAAAJAAAAB2CAYAAAAA4lGZAAAAAXNSR0IArs4c6QAAAARnQU1BAACxjwv8YQUAAAAJ0UkGAAAAAElFTkSuQmCC",
      "base64",
    ),
    {
      headers: {
        "Content-Type": "image/png",
      },
    },
  );
}
