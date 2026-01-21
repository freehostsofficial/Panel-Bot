const fs = require("fs");
const path = require("path");

async function loadMessageCommands(client, color) {
  const commandsRoot = path.join(process.cwd(), "Src", "Commands", "Message");

  if (!fs.existsSync(commandsRoot)) {
    console.error(`[MESSAGE COMMANDS] Folder not found: ${commandsRoot}`);
    return;
  }

  client.messageCommands = client.messageCommands || new Map();
  const publicCommandsArray = [];
  let loadedCount = 0;

  const commandFolders = fs.readdirSync(commandsRoot, { withFileTypes: true })
    .filter(dirent => dirent.isDirectory())
    .map(dirent => dirent.name);

  for (const folder of commandFolders) {
    const folderPath = path.join(commandsRoot, folder);
    const commandFiles = fs.readdirSync(folderPath, { withFileTypes: true })
      .filter(f => f.isFile() && f.name.endsWith(".js"))
      .map(f => f.name);

    for (const fileName of commandFiles) {
      const filePath = path.join(folderPath, fileName);
      let command;
      try {
        delete require.cache[require.resolve(filePath)];
        command = require(filePath);
      } catch (err) {
        console.error(`[MESSAGE COMMANDS] Failed to require ${fileName}`, err);
        continue;
      }

      if (!command?.data?.name) continue;

      client.messageCommands.set(command.data.name, command);
      publicCommandsArray.push(command.data.toJSON());
      loadedCount++;
    }
  }

  try {
    await client.application.commands.set(publicCommandsArray);
    console.log(`[GLOBAL COMMANDS] Loaded ${loadedCount} message commands successfully`);
  } catch (err) {
    console.error("[GLOBAL COMMANDS] Failed to register message commands", err);
  }
}

module.exports = { loadMessageCommands };
