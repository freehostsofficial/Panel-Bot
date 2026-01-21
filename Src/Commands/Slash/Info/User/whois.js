const {
  SlashCommandBuilder,
  EmbedBuilder,
  PermissionsBitField,
} = require("discord.js");

module.exports = {
  name: "whois",
  description: "Gives you insights into a user's profile.",
  category: "Info",
  usage: "/info user whois [user]",
  cooldown: 15,
  devOnly: false,

  data: new SlashCommandBuilder()
    .setName("whois")
    .setDescription("Uncover details about a user.")
    .addUserOption((option) =>
      option
        .setName("target")
        .setDescription("Pick a user to inspect")
        .setRequired(false)
    ),

  async execute(client, interaction) {
    await interaction.deferReply();

    const targetUser =
      interaction.options.getUser("target") || interaction.user;

    const fetchedUser = await client.users
      .fetch(targetUser.id, { force: true })
      .catch(() => targetUser);

    let member = null;
    if (interaction.guild) {
      member = await interaction.guild.members
        .fetch(targetUser.id)
        .catch(() => null);
    }

    const userFlags = fetchedUser.flags?.toArray() || [];

    let displayColor = "#5865F2";
    if (member?.displayHexColor && member.displayHexColor !== "#000000") {
      displayColor = member.displayHexColor;
    }

    const createdTS = Math.floor(targetUser.createdTimestamp / 1000);
    const joinedTS = member?.joinedTimestamp
      ? Math.floor(member.joinedTimestamp / 1000)
      : null;
    const boostTS = member?.premiumSinceTimestamp
      ? Math.floor(member.premiumSinceTimestamp / 1000)
      : null;

    const boosting = boostTS ? `✨ Since <t:${boostTS}:F>` : "Not boosting";

    const statusMap = {
      online: "🟢 Online",
      idle: "🟡 Idle",
      dnd: "🔴 Do Not Disturb",
      offline: "⚪ Offline",
      invisible: "⚪ Offline",
    };
    const status = statusMap[member?.presence?.status] || "⚪ Offline";

    const device = member?.presence?.clientStatus;
    const deviceDisplay = device?.desktop
      ? "🖥️ Desktop"
      : device?.mobile
      ? "📱 Mobile"
      : device?.web
      ? "🌐 Web"
      : "❔ Unknown";

    const customStatus = member?.presence?.activities?.find(
      (a) => a.type === 4
    );
    const customStatusText = customStatus
      ? `${customStatus.emoji ? customStatus.emoji.name + " " : ""}${
          customStatus.state || "No text"
        }`
      : "None";

    let permissionsDisplay = [];
    if (member) {
      if (interaction.guild.ownerId === targetUser.id) {
        permissionsDisplay = ["Server Owner 👑"];
      } else if (
        member.permissions.has(PermissionsBitField.Flags.Administrator)
      ) {
        permissionsDisplay = ["Administrator ⚙️"];
      } else {
        const perms = member.permissions.toArray().map(formatPermissionName);
        permissionsDisplay = perms.slice(0, 8);
        if (perms.length > 8)
          permissionsDisplay.push(`+${perms.length - 8} more`);
      }
    } else {
      permissionsDisplay = ["N/A"];
    }

    const roles =
      member?.roles.cache
        .filter((r) => r.id !== interaction.guild.id)
        .sort((a, b) => b.position - a.position)
        .map((r) => `<@&${r.id}>`) || [];

    const rolesText = roles.length
      ? roles.slice(0, 5).join(", ") +
        (roles.length > 5 ? ` +${roles.length - 5} more` : "")
      : "None";

    const embed = new EmbedBuilder()
      .setColor(displayColor)
      .setAuthor({
        name: `${targetUser.tag}`,
        iconURL: targetUser.displayAvatarURL({ dynamic: true }),
      })
      .setThumbnail(targetUser.displayAvatarURL({ dynamic: true, size: 512 }))
      .setDescription(`<@${targetUser.id}>`)
      .addFields(
        { name: "🆔 User ID", value: targetUser.id, inline: true },
        {
          name: "✨ Display Name",
          value: member?.displayName || fetchedUser.globalName || "Not set",
          inline: true,
        },
        { name: "🎨 Color", value: displayColor, inline: true },
        {
          name: "🗓️ Account Created",
          value: `<t:${createdTS}:F> (<t:${createdTS}:R>)`,
        },
        {
          name: "📥 Joined Server",
          value: joinedTS ? `<t:${joinedTS}:F> (<t:${joinedTS}:R>)` : "N/A",
        },
        { name: "🚀 Server Boosting", value: boosting },
        { name: "📊 Status", value: status, inline: true },
        { name: "💻 Device", value: deviceDisplay, inline: true },
        { name: "💬 Custom Status", value: customStatusText },
        {
          name: "🛡️ Permissions",
          value: permissionsDisplay.join(", "),
        },
        {
          name: `🎭 Roles (${roles.length})`,
          value: rolesText,
        }
      )
      .setFooter({
        text: `Requested by ${interaction.user.tag}`,
        iconURL: interaction.user.displayAvatarURL({ dynamic: true }),
      })
      .setTimestamp();

    if (fetchedUser.banner) {
      embed.setImage(fetchedUser.bannerURL({ dynamic: true, size: 1024 }));
    }

    if (userFlags.length) {
      embed.addFields({
        name: "🏅 Badges",
        value: userFlags.map(formatUserFlag).join(", "),
      });
    }

    return interaction.editReply({ embeds: [embed] });
  },
};

function formatPermissionName(permission) {
  return permission
    .replace(/_/g, " ")
    .toLowerCase()
    .replace(/\b\w/g, (c) => c.toUpperCase());
}

function formatUserFlag(flag) {
  const map = {
    Staff: "Discord Staff 🛠️",
    Partner: "Partnered Server Owner 🤝",
    Hypesquad: "HypeSquad Events 🌟",
    HypeSquadOnlineHouse1: "HypeSquad Bravery 🦁",
    HypeSquadOnlineHouse2: "HypeSquad Brilliance 🧠",
    HypeSquadOnlineHouse3: "HypeSquad Balance ⚖️",
    BugHunterLevel1: "Bug Hunter 🐛",
    BugHunterLevel2: "Bug Hunter Gold 🏆",
    PremiumEarlySupporter: "Early Supporter 💖",
    ActiveDeveloper: "Active Developer 👨‍💻",
    VerifiedBot: "Verified Bot 🤖",
    VerifiedDeveloper: "Verified Bot Developer ✅",
    CertifiedModerator: "Certified Moderator 🛡️",
    QuestsCompleted: "Quest Completed 🎯",
  };

  return map[flag] || `Unknown Badge (${flag})`;
}
