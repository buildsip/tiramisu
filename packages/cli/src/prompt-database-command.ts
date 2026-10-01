import { isCancel, text } from "@clack/prompts";
import { cancelInit } from "./cancel-init";
import { databaseUrlCommandSchema } from "./database-url-command-schema";

/** Always collect a fresh command; an empty answer must not reuse saved credentials setup. */
export async function promptDatabaseCommand() {
  const command = await text({
    message:
      "Paste the command that prints your PostgreSQL URL. It will run from the repository root.",
    placeholder: "doppler secrets get TIRAMISU_DATABASE_URL --plain",
    validate: (value) => {
      if (!databaseUrlCommandSchema.safeParse(value).success)
        return "Enter the full command that prints only the URL, such as doppler secrets get TIRAMISU_DATABASE_URL --plain. Do not paste the URL itself.";
    },
  });
  if (isCancel(command)) cancelInit();
  return databaseUrlCommandSchema.parse(command);
}
