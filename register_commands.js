// Standalone script to register slash commands to Discord
// Use this if commands aren't showing up in Discord

const { REST, Routes, SlashCommandBuilder } = require('discord.js');

// Load environment variables
require('dotenv').config();

const TOKEN = process.env.DISCORD_TOKEN;
const CLIENT_ID = process.env.CLIENT_ID;

// Validate environment variables
if (!TOKEN || !CLIENT_ID) {
    console.error('❌ ERROR: Missing environment variables!');
    console.error('   Please set DISCORD_TOKEN and CLIENT_ID in your .env file');
    process.exit(1);
}

// OPTIONAL: For instant updates, add your guild/server ID here
const GUILD_ID = process.env.GUILD_ID || "1514006353721688146"; // Change this to your server ID

const commands = [
    new SlashCommandBuilder()
        .setName("find")
        .setDescription("find unique server codes for a given hash")
        .setDMPermission(true)
        .addStringOption((option) =>
            option
                .setName("hash")
                .setDescription("the server hash (e.g. #ce)")
                .setRequired(true),
        )
        .addIntegerOption((option) =>
            option
                .setName("teams")
                .setDescription("how many teams are there? (default: 2)")
                .setRequired(false)
                .setMinValue(2)
                .setMaxValue(4),
        ),
    new SlashCommandBuilder()
        .setName("farm")
        .setDescription("spawn 90 bots and move them to specific coordinates")
        .setDMPermission(true)
        .addStringOption((option) =>
            option
                .setName("hash")
                .setDescription("the server hash (e.g. #ce)")
                .setRequired(true),
        )
        .addNumberOption((option) =>
            option
                .setName("x")
                .setDescription("the x coordinate")
                .setRequired(true),
        )
        .addNumberOption((option) =>
            option
                .setName("y")
                .setDescription("the y coordinate")
                .setRequired(true),
        ),
    new SlashCommandBuilder()
        .setName("premium-farm")
        .setDescription("spawn 30 bots with premium mouse-following capabilities")
        .setDMPermission(true)
        .addStringOption((option) =>
            option
                .setName("hash")
                .setDescription("the server hash (e.g. #ce)")
                .setRequired(true),
        )
        .addStringOption((option) =>
            option
                .setName("follow_mouse")
                .setDescription("enable real-time mouse following")
                .setRequired(true)
                .addChoices(
                    { name: "yes", value: "yes" },
                    { name: "no", value: "no" },
                ),
        ),
    new SlashCommandBuilder()
        .setName("connect")
        .setDescription("link your premium key to your Discord account")
        .setDMPermission(true)
        .addStringOption((option) =>
            option
                .setName("key")
                .setDescription("your premium key from the Tampermonkey script")
                .setRequired(true),
        ),
    new SlashCommandBuilder()
        .setName("verify")
        .setDescription("verify your account to access bot commands")
        .setDMPermission(true),
    new SlashCommandBuilder()
        .setName("dashboard")
        .setDescription("view your command usage dashboard")
        .setDMPermission(true),
].map((command) => command.toJSON());

const rest = new REST({ version: '10' }).setToken(TOKEN);

(async () => {
    try {
        console.log('========================================');
        console.log('SLASH COMMAND REGISTRATION TOOL');
        console.log('========================================\n');
        
        console.log(`📝 Commands to register: ${commands.length}`);
        commands.forEach((cmd, i) => {
            console.log(`   ${i + 1}. /${cmd.name}`);
        });
        console.log('');

        // Register to specific guild (INSTANT - recommended for testing)
        if (GUILD_ID) {
            console.log(`🎯 Registering to GUILD: ${GUILD_ID} (instant updates)...`);
            await rest.put(
                Routes.applicationGuildCommands(CLIENT_ID, GUILD_ID),
                { body: commands }
            );
            console.log('✅ Guild commands registered successfully!\n');
            console.log('   Commands should appear in your server immediately.');
            console.log('   Check your Discord server now!\n');
        }

        // Also register globally (takes up to 1 hour)
        console.log('🌍 Registering GLOBALLY (all servers)...');
        await rest.put(
            Routes.applicationCommands(CLIENT_ID),
            { body: commands }
        );
        console.log('✅ Global commands registered successfully!\n');
        console.log('   Note: Global commands take up to 1 hour to appear everywhere.\n');

        console.log('========================================');
        console.log('✨ REGISTRATION COMPLETE');
        console.log('========================================\n');
        
        if (GUILD_ID) {
            console.log('Next steps:');
            console.log('1. Go to your Discord server');
            console.log('2. Type "/" to see if commands appear');
            console.log('3. If not visible, wait 1-2 minutes and try again');
        } else {
            console.log('⚠️  No GUILD_ID set - only registered globally');
            console.log('   This means you need to wait up to 1 hour.');
            console.log('   For instant updates, set GUILD_ID in this file.');
        }

    } catch (error) {
        console.error('❌ Registration failed:', error);
        
        if (error.code === 50001) {
            console.error('\n⚠️  Missing Access - Bot not in guild!');
            console.error('   Make sure the bot is invited to your server.');
        } else if (error.code === 0) {
            console.error('\n⚠️  Authentication failed!');
            console.error('   Check your bot TOKEN is correct.');
        }
    }
})();
