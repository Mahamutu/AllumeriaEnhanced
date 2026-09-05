using System;
using System.Collections.Generic;
using System.IO;
using System.Text.Json;
using System.Threading;
using Allumeria;
using Allumeria.ChunkManagement;
using Allumeria.DataManagement.AssetLoading;
using Allumeria.Input;
using Allumeria.Rendering;
using Allumeria.Settings;
using Allumeria.UI;
using Allumeria.UI.UINodes;
using Allumeria.UI.Text;
using OpenTK.Graphics.OpenGL4;
using OpenTK.Mathematics;
using OpenTK.Windowing.Common;
using OpenTK.Windowing.GraphicsLibraryFramework;

namespace AllumeriaEnhanced;

public sealed class EnhancedShaderLoader : IExternalLoader
{
    private static readonly JsonSerializerOptions JsonOptions = new()
    {
        PropertyNameCaseInsensitive = true,
        WriteIndented = true
    };

    private static string ModRoot = "";
    private static string ConfigPath = "";
    private static ShaderSettings Settings = new();
    private static DateTime ConfigWriteTime;
    private static DateTime LastSettingsCheck;
    private static DateTime MenuSyncReadyAt;
    private static string LastSettingsSignature = "";
    private static bool ReloadRequested;

    private static SettingsCategory? EnhancedCategory;
    private static SettingsEntryBool? EnabledEntry;
    private static SettingsEntryButton? ShaderPackEntry;
    private static SettingsEntryEnum? PresetEntry;
    private static SettingsEntryBool? ShadowMapsEntry;
    private static SettingsEntryEnum? ShadowResolutionEntry;
    private static SettingsEntryInt? ShadowDistanceEntry;
    private static SettingsEntryInt? ShadowStrengthEntry;
    private static SettingsEntryInt? ShadowSoftnessEntry;
    private static SettingsEntryInt? ShadowBiasEntry;
    private static SettingsEntryInt? IndirectLightEntry;
    private static SettingsEntryInt? SaturationEntry;
    private static SettingsEntryInt? ContrastEntry;
    private static SettingsEntryInt? WarmthEntry;
    private static SettingsEntryInt? FogEntry;
    private static SettingsEntryInt? WaterEntry;
    private static SettingsEntryInt? CloudsEntry;
    private static SettingsEntryBool? ReflectionsEntry;
    private static SettingsEntryInt? ReflectionStrengthEntry;
    private static SettingsEntryEnum? RayQualityEntry;
    private static SettingsEntryBool? PostProcessingEntry;
    private static SettingsEntryInt? AmbientOcclusionEntry;
    private static SettingsEntryInt? SharpeningEntry;
    private static SettingsEntryBool? DepthOfFieldEntry;
    private static SettingsEntryInt? MoonRayStrengthEntry;
    private static SettingsEntryInt? CloudShadowStrengthEntry;
    private static SettingsEntryInt? ZoomFovEntry;

    private static InputChannel? ToggleChannel;
    private static InputChannel? PresetChannel;
    private static InputChannel? ReloadChannel;
    private static InputChannel? ZoomChannel;

    private static readonly List<string> ShaderPacks = new();
    private static readonly Dictionary<string, (int x, int y)> ShaderPackIcons = new(StringComparer.OrdinalIgnoreCase);
    private static bool UiIconsUploaded;
    private static DateTime LastUiIconAttempt = DateTime.MinValue;
    private static int LastPresetIndex;
    private static float ZoomCurrentFov = 90f;
    private static float LastScrollY;
    private static bool ScrollInitialised;

    private static bool ShaderPackPickerOpen;
    private static UIVerticalSelectionList? ShaderPackPicker;

    private static int ShadowFramebuffer;
    private static int ShadowDepthTexture;
    private static int CurrentShadowResolution;
    private static Shader? ShadowDepthShader;
    private static Matrix4 LightViewProjection = Matrix4.Identity;
    private static Vector3 SunDirection = new(-0.48f, 0.82f, 0.31f);
    private static bool SunDirectionInitialised;
    private static Vector3 ShadowDirection = Vector3.UnitY;
    private static bool ShadowMapActive;
    private static DateTime LastShadowDiagnostic;
    private static DateTime LastShadowRender = DateTime.MinValue;
    private static Vector3 LastShadowCenter;
    private static Vector3 LastRenderedShadowDirection = Vector3.UnitY;
    private static float LastShadowRadius;

    public void Init()
    {
        ModRoot = Path.Combine(Directory.GetCurrentDirectory(), "mods", "AllumeriaEnhanced");
        ConfigPath = Path.Combine(ModRoot, "settings.json");
        Directory.CreateDirectory(ModRoot);
        LoadSettings(writeDefaults: true);
        DiscoverShaderPacks();
        EnsureEnglishTranslations();
        RegisterGameSettings();
        MenuSyncReadyAt = DateTime.UtcNow.AddSeconds(3.0);
        DeployShaders();

        Thread attachThread = new(WaitForGameAndAttach)
        {
            IsBackground = true,
            Name = "Allumeria Enhanced attach"
        };
        attachThread.Start();
        Logger.Info("[Allumeria Enhanced] Loader 0.13.2 live-reload initialized.");
    }

    private static void WaitForGameAndAttach()
    {
        while (Game.game == null)
            Thread.Sleep(25);
        Game.game.UpdateFrame += OnUpdateFrame;
        Game.game.RenderFrame += OnRenderFrame;
        Logger.Info("[Allumeria Enhanced] Runtime controls attached.");
    }

    // Queue only: OpenGL compilation must happen with the render context current.
    private static bool RuntimeReloadPending;
    private static void RecompileShadersLive() => RuntimeReloadPending = true;

    private static void ReloadProgramsOnRenderThread()
    {
        var replacements = new List<Shader>();
        Shader Compile(string vertex, string fragment)
        {
            var shader = new Shader("res/shaders/" + vertex, "res/shaders/" + fragment);
            replacements.Add(shader);
            GL.GetProgram(shader.Handle, GetProgramParameterName.LinkStatus, out int linked);
            GL.GetProgram(shader.Handle, GetProgramParameterName.AttachedShaders, out int count);
            int[] stages = new int[count];
            GL.GetAttachedShaders(shader.Handle, count, out int written, stages);
            for (int i = 0; i < written; i++)
            {
                GL.DetachShader(shader.Handle, stages[i]);
                GL.DeleteShader(stages[i]);
            }
            if (linked == 0)
                throw new InvalidOperationException(fragment + ": " + GL.GetProgramInfoLog(shader.Handle));
            return shader;
        }
        try
        {
            DeployShaders();
            var terrain = Compile("shader.vert", "shader.frag");
            var entity = Compile("entity/shader.vert", "entity/shader.frag");
            var block = Compile("blockentity/shader.vert", "blockentity/shader.frag");
            var water = Compile("shaderTransparent.vert", "shaderTransparent.frag");
            var billboard = Compile("billboard.vert", "billboard.frag");
            var particle = Compile("particle/billboard.vert", "particle/billboard.frag");
            var lod = Compile("particle/plantLODBillboard.vert", "particle/billboard.frag");
            var cloud = Compile("shaderClouds.vert", "shaderClouds.frag");
            var sky = Compile("shaderSky.vert", "shaderSky.frag");
            var star = Compile("shaderWorld.vert", "shaderWorld.frag");
            var depth = Compile("shadow/shadow.vert", "shadow/shadow.frag");
            var retro = Compile("retro/retro.vert", "retro/retro.frag");
            foreach (var shader in replacements)
            {
                shader.SetUniformFloat("fogStart", 64f);
                shader.SetUniformFloat("fogEnd", (MultiChunkRenderer.renderDistance * 32f - 16f));
            }
            cloud.SetUniformFloat("fogEnd", 384f);
            star.SetUniformFloat("alpha", 1f);
            terrain.SetUniformVec3Array("paintColours", Allumeria.Items.ItemTypes.ItemPaintRoller.coloursVec3);
            var old = new Shader?[] { WorldRenderer.terrainShader, WorldRenderer.entityShader,
                WorldRenderer.blockEntityShader, WorldRenderer.waterShader, WorldRenderer.billboardShader,
                WorldRenderer.particleShader, WorldRenderer.lodLeafShader, WorldRenderer.cloudShader,
                WorldRenderer.skyShader, WorldRenderer.starShader, ShadowDepthShader, Drawing.shaderRetro };
            // Commit only when every program has linked successfully.
            WorldRenderer.terrainShader = terrain; WorldRenderer.entityShader = entity;
            WorldRenderer.blockEntityShader = block; WorldRenderer.waterShader = water;
            WorldRenderer.billboardShader = billboard; WorldRenderer.particleShader = particle;
            WorldRenderer.lodLeafShader = lod; WorldRenderer.cloudShader = cloud;
            WorldRenderer.skyShader = sky; WorldRenderer.starShader = star; ShadowDepthShader = depth; Drawing.shaderRetro = retro;
            replacements.Clear();
            GL.UseProgram(0);
            Shader.currentHandle = 0;
            foreach (var shader in old) shader?.Dispose();
            ShadowMapActive = false;
            Notify("Live reload OK: " + Settings.ShaderPack + " (12 programs)");
        }
        catch (Exception ex)
        {
            GL.UseProgram(0);
            Shader.currentHandle = 0;
            foreach (var shader in replacements) shader.Dispose();
            Notify("Reload failed; previous shaders kept. See log.");
            Logger.Error("[Allumeria Enhanced] Live reload failed: " + ex);
        }
    }

    private static void OnUpdateFrame(FrameEventArgs args)
    {
        try
        {
            ConsumeZoomWheel();
            SyncSettingsFromMenu();
            DateTime now = DateTime.UtcNow;
            if ((now - LastSettingsCheck).TotalSeconds < 1.0)
                return;
            LastSettingsCheck = now;

            if (ReloadRequested)
            {
                ReloadRequested = false;
                LoadSettings(writeDefaults: false);
                DiscoverShaderPacks();
                ApplySettingsToEntries();
                RecompileShadersLive();
            }

            DateTime writeTime = File.Exists(ConfigPath) ? File.GetLastWriteTimeUtc(ConfigPath) : DateTime.MinValue;
            if (writeTime > ConfigWriteTime)
            {
                LoadSettings(writeDefaults: false);
                ApplySettingsToEntries();
                RecompileShadersLive();
            }

            string signature = JsonSerializer.Serialize(Settings, JsonOptions);
            if (signature != LastSettingsSignature)
            {
                LastSettingsSignature = signature;
                SaveSettings();
            }
        }
        catch (Exception ex)
        {
            Logger.Error("[Allumeria Enhanced] Update failed: " + ex);
        }
    }

    private static void OnRenderFrame(FrameEventArgs args)
    {
        try
        {
            ProcessControls();
            if (RuntimeReloadPending && Game.mainLoadDone && Game.threadedLoadDone)
            {
                RuntimeReloadPending = false;
                ReloadProgramsOnRenderThread();
            }
            UpdateZoom(args.Time);
            UpdateEnvironment(args.Time);
            EnsureUiIcons();
            EnhanceShaderPackMenu();
            if (Settings.Enabled && Settings.ShadowMaps && Game.mainLoadDone && Game.threadedLoadDone)
                EnsureShadowResources();
            RenderShadowMap(args.Time);
            RenderLocalShadow();
            EnsureViewModelMask();
            ApplyAllShaderSettings();
            ApplyAuroraPost();
        }
        catch (Exception ex)
        {
            ShadowMapActive = false;
            Logger.Error("[Allumeria Enhanced] Render extension failed: " + ex);
        }
    }

    private static void ProcessControls()
    {
        if (ToggleChannel?.IsPressed() == true)
        {
            Settings.Enabled = !Settings.Enabled;
            if (EnabledEntry != null)
                EnabledEntry.value = Settings.Enabled;
            SaveSettings();
            Notify(Settings.Enabled ? "shaders ON" : "shaders OFF");
        }
        if (PresetChannel?.IsPressed() == true)
        {
            int next = ((PresetIndex(Settings.Preset) + 1) % 4);
            ApplyPreset(next);
            LastPresetIndex = next;
            ApplySettingsToEntries();
            SaveSettings();
            Notify("preset: " + Settings.Preset);
        }
        if (ReloadChannel?.IsPressed() == true)
            ReloadRequested = true;
    }

    private static void UpdateZoom(double deltaTime)
    {
        if (Game.camera == null || Game.game == null)
            return;

        float scrollY = Game.game.MouseState.Scroll.Y;
        if (!ScrollInitialised)
        {
            LastScrollY = scrollY;
            ScrollInitialised = true;
        }
        float scrollDelta = scrollY - LastScrollY;
        LastScrollY = scrollY;

        bool gameplayInputAvailable = Game.inGame && Game.clientState?.player != null &&
            !Game.clientState.player.inMenu && InputManager.cursorLocked &&
            UIManager.targetNode is not UITextInput && !InputManager.listenMode;
        bool held = ZoomChannel?.IsDown() == true && gameplayInputAvailable;
        if (held && MathF.Abs(scrollDelta) > 0.01f)
        {
            Settings.ZoomFov = Math.Clamp(Settings.ZoomFov - (int)MathF.Round(scrollDelta * 3f), 10, 70);
            if (ZoomFovEntry != null)
                ZoomFovEntry.value = Settings.ZoomFov;
            SaveSettings();
        }

        float normalFov = Math.Clamp(Game.camera.fov + Game.camera.fovModifierLerped, 30f, 150f);
        float targetFov = held ? MathF.Min(Settings.ZoomFov, normalFov) : normalFov;
        if (ZoomCurrentFov <= 1f || !float.IsFinite(ZoomCurrentFov))
            ZoomCurrentFov = normalFov;
        float smoothing = 1f - MathF.Exp(-14f * (float)Math.Clamp(deltaTime, 0.0, 0.1));
        ZoomCurrentFov = MathHelper.Lerp(ZoomCurrentFov, targetFov, smoothing);
        Game.camera.displayFov = ZoomCurrentFov;
        Game.camera.fovRadians = MathHelper.DegreesToRadians(ZoomCurrentFov);
        Game.camera.projectionMatrix = Matrix4.CreatePerspectiveFieldOfView(Game.camera.fovRadians,
            (float)Game.gameBuffer.width / Math.Max(Game.gameBuffer.height, 1), 0.01f, 1000f);

    }

    private static readonly System.Reflection.FieldInfo? PreviousScrollField =
        typeof(MouseState).GetField("<PreviousScroll>k__BackingField",
            System.Reflection.BindingFlags.Instance | System.Reflection.BindingFlags.NonPublic);

    private static void ConsumeZoomWheel()
    {
        if (Game.game == null || ZoomChannel == null) return;
        // Before InputManager.Update / World.RenderUpdate: consume wheel delta only.
        ZoomChannel.Update(Game.game.KeyboardState, Game.game.MouseState);
        bool allowed = Game.inGame && Game.clientState?.player != null &&
            !Game.clientState.player.inMenu && InputManager.cursorLocked &&
            UIManager.targetNode is not UITextInput && !InputManager.listenMode;
        if (allowed && ZoomChannel.IsDown() && PreviousScrollField != null)
        {
            var mouse = Game.game.MouseState;
            PreviousScrollField.SetValue(mouse, mouse.Scroll);
        }
    }

    private static void ToggleShaderPackPicker()
    {
        ShaderPackPickerOpen = !ShaderPackPickerOpen;
        ShaderPackPicker = null;
        if (Game.menu_settings != null)
            Game.menu_settings.refreshNeeded = true;
    }

    private static void OpenShaderPackFolder()
    {
        string folder = Path.Combine(ModRoot, "shaderpacks");
        Directory.CreateDirectory(folder);
        System.Diagnostics.Process.Start(new System.Diagnostics.ProcessStartInfo
        {
            FileName = folder,
            UseShellExecute = true
        });
    }

    private static void EnhanceShaderPackMenu()
    {
        if (Game.menu_settings?.list_options == null || ShaderPackEntry == null)
            return;

        UIOptionEntry? packRow = null;
        foreach (UINode node in Game.menu_settings.list_options.nodes)
        {
            if (node is UIOptionEntry option && ReferenceEquals(option.entry, ShaderPackEntry))
            {
                packRow = option;
                break;
            }
        }
        if (packRow == null)
        {
            ShaderPackPicker = null;
            return;
        }

        if (packRow.optionInput is UIButton button)
        {
            if (button is not MarqueeShaderPackButton marquee)
            {
                int oldIndex = packRow.nodes.IndexOf(button);
                packRow.nodes.Remove(button);
                marquee = (MarqueeShaderPackButton)packRow.RegisterNode(new MarqueeShaderPackButton("ae_shader_pack_button", Settings.ShaderPack));
                packRow.nodes.Remove(marquee);
                packRow.nodes.Insert(Math.Max(oldIndex, 0), marquee);
                packRow.optionInput = marquee;
            }
            marquee.SetFullText(Settings.ShaderPack);
            (int x, int y) selectedIcon = ShaderPackIcons.TryGetValue(Settings.ShaderPack, out var coords) ? coords : (688, 128);
            marquee.SetIcon(selectedIcon.x, selectedIcon.y);
        }
        if (!ShaderPackPickerOpen || ShaderPackPicker != null)
            return;

        (int, int)[] icons = new (int, int)[ShaderPacks.Count];
        for (int i = 0; i < icons.Length; ++i)
            icons[i] = ShaderPackIcons.TryGetValue(ShaderPacks[i], out var coords) ? coords : (688, 128);
        ShaderPackPicker = new UIVerticalSelectionList("ae_shader_pack_picker", ShaderPacks.ToArray(), icons)
        {
            value = PackIndex(Settings.ShaderPack)
        };
        ShaderPackPicker.selectionChangedAction = () =>
        {
            Settings.ShaderPack = ShaderPacks[Math.Clamp(ShaderPackPicker.value, 0, ShaderPacks.Count - 1)];
            ApplyPackDefaults(Settings.ShaderPack);
            ApplySettingsToEntries();
            SaveSettings();
            ShaderPackPickerOpen = false;
            ShaderPackPicker = null;
            Game.menu_settings.refreshNeeded = true;
            RecompileShadersLive();
        };
        Game.menu_settings.list_options.RegisterNode(ShaderPackPicker);
        Game.menu_settings.list_options.nodes.Remove(ShaderPackPicker);
        int rowIndex = Game.menu_settings.list_options.nodes.IndexOf(packRow);
        Game.menu_settings.list_options.nodes.Insert(rowIndex + 1, ShaderPackPicker);
    }

    private static readonly System.Reflection.FieldInfo? WorldRendererField =
        typeof(Game).GetField("worldRenderer", System.Reflection.BindingFlags.Instance | System.Reflection.BindingFlags.NonPublic);
    private static Vector3 CloudTint = Vector3.One;
    private static float BiomeFog = 1f, BiomeWarmth;
    private static float Underwater, WaterSurface, MoonStrength, MoonPhase, MoonIllumination, MorningRays;
    private static Vector3 MoonDirection=Vector3.UnitY;
    private static void UpdateEnvironment(double dt)
    {
        if (!Game.inGame || Game.camera == null || Game.gameState?.worldManager.world == null) return;
        if (WorldRendererField?.GetValue(Game.game) is WorldRenderer renderer)
            CloudTint = new Vector3(renderer.cloudColor.X, renderer.cloudColor.Y, renderer.cloudColor.Z);
        var pos = Game.camera.position;
        var cm=Game.gameState.worldManager.world.chunkManager;
        int wx=(int)MathF.Floor(pos.X), wy=(int)MathF.Floor(pos.Y), wz=(int)MathF.Floor(pos.Z);
        Underwater=cm.GetBlockWithMetadata(wx,wy,wz).fluidID==1?1f:0f;
        WaterSurface=pos.Y;
        if(Underwater>0f){
            int top=wy;
            while(top<wy+24 && cm.GetBlockWithMetadata(wx,top,wz).fluidID==1)top++;
            WaterSurface=top;
        }
        float phase=(float)Game.gameState.worldManager.world.timeManager.worldTime/86400f;
        MoonDirection=Vector3.TransformPosition(Vector3.UnitY,Matrix4.CreateRotationX(phase*MathF.PI*2f)).Normalized();
        float lunarDays=Game.gameState.worldManager.world.timeManager.worldDay+phase;
        MoonPhase=(lunarDays/8f)%1f;
        MoonIllumination=0.5f+0.5f*MathF.Cos(MoonPhase*MathF.PI*2f);
        MoonStrength=Math.Clamp((MoonDirection.Y-0.02f)/0.3f,0f,1f)*MoonIllumination;
        float morning=Math.Clamp((phase-0.23f)/0.05f,0f,1f);
        float lateMorning=Math.Clamp((phase-0.34f)/0.12f,0f,1f);
        MorningRays=1f+0.55f*(morning*morning*(3f-2f*morning))*(1f-lateMorning*lateMorning*(3f-2f*lateMorning));
        // Keep the celestial direction current at night as well.
        SunDirection=Vector3.TransformPosition(-Vector3.UnitY,
            Matrix4.CreateRotationX(phase*MathF.PI*2f)*Matrix4.CreateRotationY(MathF.PI/10f)).Normalized();
        int biome = Game.gameState.worldManager.world.chunkManager.GetBiome(
            (int)MathF.Floor(pos.X), (int)MathF.Floor(pos.Y), (int)MathF.Floor(pos.Z));
        float target = biome switch { 2 => 1.12f, 3 => 0.85f, 4 => 0.45f, 5 => 1.18f, 6 => 0.8f, 7 => 0.65f, _ => 1f };
        BiomeFog += (target - BiomeFog) * (1f - MathF.Exp(-(float)Math.Clamp(dt,0,0.1)*0.8f));
        float warmthTarget = biome == 3 ? 1f : 0f;
        BiomeWarmth += (warmthTarget - BiomeWarmth) * (1f - MathF.Exp(-(float)Math.Clamp(dt,0,0.1)*0.9f));
    }

    private static int ViewModelMask, MaskWidth, MaskHeight, MaskFramebuffer;
    private static void EnsureViewModelMask()
    {
        if(!Game.mainLoadDone || Game.gameBuffer==null) return;
        var buffer=Game.gameBuffer;
        int previous,active;GL.GetInteger(GetPName.FramebufferBinding,out previous);
        GL.GetInteger(GetPName.ActiveTexture,out active);
        GL.ActiveTexture(TextureUnit.Texture8);
        if(ViewModelMask==0 || MaskWidth!=buffer.width || MaskHeight!=buffer.height || MaskFramebuffer!=buffer.ID){
            if(ViewModelMask!=0)GL.DeleteTexture(ViewModelMask);
            ViewModelMask=GL.GenTexture();GL.BindTexture(TextureTarget.Texture2D,ViewModelMask);
            GL.TexImage2D(TextureTarget.Texture2D,0,PixelInternalFormat.R8,buffer.width,buffer.height,0,PixelFormat.Red,PixelType.UnsignedByte,IntPtr.Zero);
            GL.TexParameter(TextureTarget.Texture2D,TextureParameterName.TextureMinFilter,(int)TextureMinFilter.Nearest);
            GL.TexParameter(TextureTarget.Texture2D,TextureParameterName.TextureMagFilter,(int)TextureMagFilter.Nearest);
            GL.TexParameter(TextureTarget.Texture2D,TextureParameterName.TextureWrapS,(int)TextureWrapMode.ClampToEdge);
            GL.TexParameter(TextureTarget.Texture2D,TextureParameterName.TextureWrapT,(int)TextureWrapMode.ClampToEdge);
            GL.BindFramebuffer(FramebufferTarget.Framebuffer,buffer.ID);
            GL.FramebufferTexture2D(FramebufferTarget.Framebuffer,FramebufferAttachment.ColorAttachment1,TextureTarget.Texture2D,ViewModelMask,0);
            GL.DrawBuffers(2,new[]{DrawBuffersEnum.ColorAttachment0,DrawBuffersEnum.ColorAttachment1});
            if(GL.CheckFramebufferStatus(FramebufferTarget.Framebuffer)!=FramebufferErrorCode.FramebufferComplete)
                throw new InvalidOperationException("Viewmodel mask framebuffer incomplete");
            MaskWidth=buffer.width;MaskHeight=buffer.height;MaskFramebuffer=buffer.ID;
        }
        GL.BindTexture(TextureTarget.Texture2D,ViewModelMask);
        GL.BindFramebuffer(FramebufferTarget.Framebuffer,previous);GL.ActiveTexture((TextureUnit)active);
    }

    private static bool PostOverride, SavedDither;
    private static void ApplyAuroraPost()
    {
        bool active=Settings.Enabled && Settings.PostProcessing &&
            Settings.ShaderPack.Equals("Aurora",StringComparison.OrdinalIgnoreCase) &&
            Game.clientState?.player!=null && Game.gameBuffer.depthID!=0;
        if(active && !PostOverride){SavedDither=GameSettings.dither_shader.value;PostOverride=true;}
        if(!active && PostOverride){GameSettings.dither_shader.value=SavedDither;PostOverride=false;}
        if(active)GameSettings.dither_shader.value=true;
        var shader=Drawing.shaderRetro;
        if(shader==null)return;
        shader.SetUniformFloat("ae_postEnabled",active?1f:0f);
        if(!active)return;
        GL.GetInteger(GetPName.ActiveTexture,out int previous);
        GL.ActiveTexture(TextureUnit.Texture9);
        GL.BindTexture(TextureTarget.Texture2D,Game.gameBuffer.depthID);
        GL.ActiveTexture(TextureUnit.Texture10);
        GL.BindTexture(TextureTarget.Texture2D,Game.waterBuffer.texture.id);
        shader.SetUniform1i("ae_depth",9);
        shader.SetUniform1i("ae_waterColor",10);
        shader.SetUniform1i("ae_handMask",8);
        shader.SetUniformFloat("ae_maskValid",ViewModelMask!=0?1f:0f);
        shader.SetUniformMat4("ae_inverseProjection",Matrix4.Invert(Game.camera.projectionMatrix));
        // The underwater composite and opaque depth do not describe the same edges.
        // Avoid adding depth contours and sharpening halos to submerged block seams.
        bool submerged = Underwater > 0.5f;
        shader.SetUniformFloat("ae_ao",submerged?0f:Clamp(Settings.AmbientOcclusion,0f,1f));
        shader.SetUniformFloat("ae_sharpen",submerged?0f:Clamp(Settings.Sharpening,0f,1f));
        shader.SetUniformFloat("ae_dof",!submerged && Settings.DepthOfField?1f:0f);
        GL.ActiveTexture((TextureUnit)previous);
    }

    private static void ApplyAllShaderSettings()
    {
        int previousActiveTexture;
        GL.GetInteger(GetPName.ActiveTexture, out previousActiveTexture);
        if (ShadowDepthTexture != 0 && ShadowMapActive)
        {
            GL.ActiveTexture(TextureUnit.Texture6);
            GL.BindTexture(TextureTarget.Texture2D, ShadowDepthTexture);
        }
        if (LocalCube != 0)
        {
            GL.ActiveTexture(TextureUnit.Texture7);
            GL.BindTexture(TextureTarget.TextureCubeMap, LocalCube);
        }
        ApplySettings(WorldRenderer.terrainShader);
        ApplySettings(WorldRenderer.entityShader);
        ApplySettings(WorldRenderer.blockEntityShader);
        ApplySettings(WorldRenderer.waterShader);
        ApplySettings(WorldRenderer.billboardShader);
        ApplySettings(WorldRenderer.particleShader);
        ApplySettings(WorldRenderer.lodLeafShader);
        ApplySettings(WorldRenderer.cloudShader);
        ApplySettings(WorldRenderer.skyShader);
        ApplySettings(WorldRenderer.starShader);
        GL.ActiveTexture((TextureUnit)previousActiveTexture);
    }

    private static void ApplySettings(Shader? shader)
    {
        if (shader == null)
            return;
        shader.SetUniformFloat("ae_enabled", Settings.Enabled ? 1f : 0f);
        shader.SetUniformFloat("ae_shadowStrength", Clamp(Settings.ShadowStrength, 0f, 1.5f));
        shader.SetUniformFloat("ae_indirectLight", Clamp(Settings.IndirectLight, 0.25f, 1.5f));
        shader.SetUniformFloat("ae_saturation", Clamp(Settings.Saturation, 0f, 2f));
        shader.SetUniformFloat("ae_contrast", Clamp(Settings.Contrast, 0.5f, 1.8f));
        shader.SetUniformFloat("ae_warmth", Clamp(Settings.Warmth, -1f, 1f));
        shader.SetUniformFloat("ae_fogStrength", Clamp(Settings.FogStrength, 0f, 1f));
        shader.SetUniformFloat("ae_waterRefraction", Clamp(Settings.WaterRefraction, 0f, 2f));
        shader.SetUniformFloat("ae_cloudSoftness", Clamp(Settings.CloudSoftness, 0f, 1f));
        shader.SetUniformFloat("ae_reflections", Settings.Reflections ? 1f : 0f);
        shader.SetUniformFloat("ae_reflectionStrength", Clamp(Settings.ReflectionStrength, 0f, 1.5f));
        shader.SetUniform1i("ae_raySteps", Math.Clamp(Settings.RaySteps, 8, 48));
        shader.SetUniform1i("ae_localShadow", 7);
        shader.SetUniformFloat("ae_localActive", LocalShadowActive ? 1f : 0f);
        shader.SetUniformVec3("ae_localPosition", LocalPosition);
        shader.SetUniformVec3("ae_localShadowPosition", LocalShadowActive ? LastRenderedLocalPosition : LocalPosition);
        shader.SetUniformVec3("ae_localColor", LocalColor);
        bool heldEmitter=Game.clientState?.player?.heldItem?.block?.emitsLight==true;
        float sourceDistance=(Game.camera.position-LocalPosition).Length;
        float sourceFade=1f-Math.Clamp((sourceDistance-5f)/5f,0f,1f);
        sourceFade=sourceFade*sourceFade*(3f-2f*sourceFade);
        shader.SetUniformFloat("ae_localGain",heldEmitter?0.65f:0.20f*sourceFade);
        shader.SetUniformFloat("ae_localRange", LocalRange);
        shader.SetUniform1i("ae_shadowMap", 6);
        shader.SetUniformFloat("ae_shadowMapEnabled", ShadowMapActive ? 1f : 0f);
        shader.SetUniformFloat("ae_shadowSoftness", Clamp(Settings.ShadowSoftness, 0f, 2f));
        shader.SetUniformFloat("ae_shadowBias", Clamp(Settings.ShadowBias, 0.0001f, 0.01f));
        shader.SetUniformMat4("ae_lightViewProjection", LightViewProjection);
        shader.SetUniformVec3("ae_sunDirection", SunDirection);
        shader.SetUniformVec3("ae_shadowDirection", ShadowDirection);
        shader.SetUniformFloat("ae_cloudTime", (float)Game.secondsElapsed);
        shader.SetUniformVec3("ae_cloudTint", CloudTint);
        shader.SetUniformFloat("ae_biomeFog", BiomeFog);
        shader.SetUniformFloat("ae_biomeWarmth", BiomeWarmth);
        shader.SetUniform1i("ae_viewModelMask",8);
        shader.SetUniformFloat("ae_maskReady",ViewModelMask!=0?1f:0f);
        shader.SetUniformFloat("ae_firstPerson",Game.clientState?.player?.thirdPerson==false?1f:0f);
        shader.SetUniformVec3("ae_handOrigin",Game.camera.position+Game.camera.up*-0.2f+Game.camera.front*0.05f+Game.camera.right*0.1f);
        shader.SetUniformFloat("ae_underwater", Underwater);
        shader.SetUniformFloat("ae_waterSurface", WaterSurface);
        shader.SetUniformFloat("ae_moonStrength", MoonStrength);
        shader.SetUniformFloat("ae_moonPhase", MoonPhase);
        shader.SetUniformFloat("ae_moonIllumination", MoonIllumination);
        shader.SetUniformFloat("ae_morningRays", MorningRays);
        shader.SetUniformFloat("ae_moonRayStrength", Clamp(Settings.MoonRayStrength, 0f, 2.5f));
        shader.SetUniformFloat("ae_cloudShadowStrength", Clamp(Settings.CloudShadowStrength, 0f, 0.35f));
        shader.SetUniformVec3("ae_moonDirection", MoonDirection);
        Vector3 handLightPosition = Game.camera?.position ?? Vector3.Zero;
        if (Game.clientState?.player != null)
            handLightPosition = Game.clientState.player.lerpedPosition + new Vector3(0f, 1.25f, 0f);
        Vector3 handLightColor = Vector3.Zero;
        var heldBlock = Game.clientState?.player?.heldItem?.block;
        if (heldBlock?.emitsLight == true)
        {
            byte[] emission = heldBlock.GetLightEmission(0u, 0);
            handLightColor = new Vector3(emission[0], emission[1], emission[2]) / 15f;
        }
        shader.SetUniformVec3("ae_handLightPosition", handLightPosition);
        shader.SetUniformVec3("ae_handLightColor", handLightColor);
    }

    private static int LocalCube, LocalFramebuffer;
    private static bool LocalShadowActive;
    private static Vector3 LocalPosition, LocalColor;
    private static DateTime LastLocalScan;
    private static Vector3 CachedLocalPosition, CachedLocalColor;
    private const float LocalRange = 16f;
    private const int LocalShadowResolution = 256;
    private static DateTime LastLocalShadowRender = DateTime.MinValue;
    private static Vector3 LastRenderedLocalPosition, LastRenderedLocalColor;

    // Existing loaded geometry only: never create chunks or depend on camera frustum.
    private static IEnumerable<Chunk> LocalCasters(Vector3 light, float range)
    {
        var manager=Game.gameState.worldManager.world.chunkManager;
        int minX=(int)MathF.Floor((light.X-range)/32f), maxX=(int)MathF.Floor((light.X+range)/32f);
        int minY=(int)MathF.Floor((light.Y-range)/32f), maxY=(int)MathF.Floor((light.Y+range)/32f);
        int minZ=(int)MathF.Floor((light.Z-range)/32f), maxZ=(int)MathF.Floor((light.Z+range)/32f);
        for(int x=minX;x<=maxX;x++)for(int y=minY;y<=maxY;y++)for(int z=minZ;z<=maxZ;z++){
            var chunk=manager.RequestIfExists(x,y,z);
            if(chunk?.hasModel==true) yield return chunk;
        }
    }
    private static void RenderLocalShadow()
    {
        LocalShadowActive = false;
        if (!Settings.Enabled || !Settings.ShadowMaps || !Game.inGame ||
            Game.gameState?.worldManager.world == null || Game.clientState?.player == null) return;
        var player = Game.clientState.player;
        LocalColor = Vector3.Zero;
        var held = player.heldItem?.block;
        if (held?.emitsLight == true)
        {
            byte[] light = held.GetLightEmission(0u, 0);
            LocalColor = new Vector3(light[0],light[1],light[2])/15f;
            LocalPosition = player.lerpedPosition + new Vector3(0,1.25f,0);
        }
        else
        {
            if ((DateTime.UtcNow-LastLocalScan).TotalSeconds > 0.5)
            {
                LastLocalScan = DateTime.UtcNow;
                bool retainPrevious = CachedLocalColor.LengthSquared > 0.001f;
                Vector3 previousSourcePosition = CachedLocalPosition;
                CachedLocalColor = Vector3.Zero;
                float nearest = 100f;
                Vector3 center = player.lerpedPosition;
                var manager = Game.gameState.worldManager.world.chunkManager;
                for(int x=-8;x<=8;x++) for(int y=-5;y<=5;y++) for(int z=-8;z<=8;z++)
                {
                    int bx=(int)MathF.Floor(center.X)+x, by=(int)MathF.Floor(center.Y)+y, bz=(int)MathF.Floor(center.Z)+z;
                    Vector3 pos=new Vector3(bx+0.5f,by+0.65f,bz+0.5f);
                    float distance=(pos-center).LengthSquared;
                    if(distance>=100f) continue;
                    // Hysteresis: a new source must be substantially nearer, not a few cm nearer.
                    float score=distance*(retainPrevious && (pos-previousSourcePosition).LengthSquared<0.01f?0.64f:1f);
                    if(score>=nearest) continue;
                    var block=manager.GetBlockIfExists(bx,by,bz);
                    if(block?.emitsLight != true) continue;
                    byte[] light=block.GetLightEmission(0u,0);
                    if(light[0]+light[1]+light[2]==0) continue;
                    nearest=score; CachedLocalPosition=pos;
                    CachedLocalColor=new Vector3(light[0],light[1],light[2])/15f;
                }
            }
            LocalPosition=CachedLocalPosition;LocalColor=CachedLocalColor;
        }
        if(LocalColor.LengthSquared < 0.001f) return;
        EnsureShadowResources();
        DateTime now=DateTime.UtcNow;
        bool heldEmitter=held?.emitsLight==true;
        double updateInterval=heldEmitter?0.05:0.20;
        bool reusable=LocalCube!=0 &&
            (LocalPosition-LastRenderedLocalPosition).LengthSquared<(heldEmitter?0.0225f:0.01f) &&
            (LocalColor-LastRenderedLocalColor).LengthSquared<0.0001f;
        if(reusable && (now-LastLocalShadowRender).TotalSeconds<updateInterval)
        {
            LocalShadowActive=true;
            return;
        }
        int framebuffer, active, program, depthFunction;
        GL.GetInteger(GetPName.FramebufferBinding,out framebuffer);
        GL.GetInteger(GetPName.ActiveTexture,out active);
        GL.GetInteger(GetPName.CurrentProgram,out program);
        GL.GetInteger(GetPName.DepthFunc,out depthFunction);
        int[] viewport=new int[4];GL.GetInteger(GetPName.Viewport,viewport);
        bool blend=GL.IsEnabled(EnableCap.Blend), cull=GL.IsEnabled(EnableCap.CullFace);
        try
        {
            GL.ActiveTexture(TextureUnit.Texture7);
            if(LocalCube==0)
            {
                LocalCube=GL.GenTexture();LocalFramebuffer=GL.GenFramebuffer();
                GL.BindTexture(TextureTarget.TextureCubeMap,LocalCube);
                for(int face=0;face<6;face++)
                    GL.TexImage2D((TextureTarget)((int)TextureTarget.TextureCubeMapPositiveX+face),0,
                        PixelInternalFormat.DepthComponent24,LocalShadowResolution,LocalShadowResolution,0,PixelFormat.DepthComponent,PixelType.Float,IntPtr.Zero);
                GL.TexParameter(TextureTarget.TextureCubeMap,TextureParameterName.TextureMinFilter,(int)TextureMinFilter.Nearest);
                GL.TexParameter(TextureTarget.TextureCubeMap,TextureParameterName.TextureMagFilter,(int)TextureMagFilter.Nearest);
                GL.TexParameter(TextureTarget.TextureCubeMap,TextureParameterName.TextureWrapS,(int)TextureWrapMode.ClampToEdge);
                GL.TexParameter(TextureTarget.TextureCubeMap,TextureParameterName.TextureWrapT,(int)TextureWrapMode.ClampToEdge);
                GL.TexParameter(TextureTarget.TextureCubeMap,TextureParameterName.TextureWrapR,(int)TextureWrapMode.ClampToEdge);
            }
            GL.BindFramebuffer(FramebufferTarget.Framebuffer,LocalFramebuffer);
            GL.DrawBuffer(DrawBufferMode.None);GL.ReadBuffer(ReadBufferMode.None);
            GL.Viewport(0,0,LocalShadowResolution,LocalShadowResolution);
            GL.ColorMask(false,false,false,false);GL.DepthMask(true);GL.Enable(EnableCap.DepthTest);
            GL.DepthFunc(DepthFunction.Less);GL.Disable(EnableCap.Blend);GL.Disable(EnableCap.CullFace);
            Vector3[] directions={Vector3.UnitX,-Vector3.UnitX,Vector3.UnitY,-Vector3.UnitY,Vector3.UnitZ,-Vector3.UnitZ};
            Vector3[] ups={-Vector3.UnitY,-Vector3.UnitY,Vector3.UnitZ,-Vector3.UnitZ,-Vector3.UnitY,-Vector3.UnitY};
            ShadowDepthShader!.SetUniform1i("ae_pointPass",1);
            ShadowDepthShader.SetUniformVec3("ae_pointPosition",LocalPosition);
            ShadowDepthShader.SetUniform1i("ae_skipSourceBlock",held?.emitsLight==true?0:1);
            ShadowDepthShader.SetUniformFloat("ae_pointFar",LocalRange);
            ShadowDepthShader.SetUniformFloat("uTime",(float)Game.gameState.worldManager.world.timeManager.worldTime/86400f);
            ShadowDepthShader.SetUniform1i("leafSway",GameSettings.leaf_sway.value?1:0);
            for(int face=0;face<6;face++)
            {
                GL.FramebufferTexture2D(FramebufferTarget.Framebuffer,FramebufferAttachment.DepthAttachment,
                    (TextureTarget)((int)TextureTarget.TextureCubeMapPositiveX+face),LocalCube,0);
                if(GL.CheckFramebufferStatus(FramebufferTarget.Framebuffer)!=FramebufferErrorCode.FramebufferComplete)
                    throw new InvalidOperationException("Local shadow framebuffer incomplete");
                GL.Clear(ClearBufferMask.DepthBufferBit);
                Matrix4 matrix=Matrix4.LookAt(LocalPosition,LocalPosition+directions[face],ups[face])*
                    Matrix4.CreatePerspectiveFieldOfView(MathF.PI/2f,1f,0.08f,LocalRange);
                ShadowDepthShader.SetUniformMat4("ae_lightViewProjection",matrix);
                foreach(Chunk chunk in LocalCasters(LocalPosition,LocalRange))
                {
                    if(!chunk.hasModel) continue;
                    Vector3 corner=new Vector3(chunk.posX,chunk.posY,chunk.posZ)*32f;
                    Vector3 nearest=Vector3.Clamp(LocalPosition,corner,corner+new Vector3(32f));
                    if((nearest-LocalPosition).LengthSquared>LocalRange*LocalRange)continue;
                    chunk.chunkModel.mesh.Draw(ShadowDepthShader,AssetManager.blockAtlas.generatedTexture,
                        corner,0f,true,AssetManager.blockAtlas.generatedTextureEmission,null!,null!,false,true,false);
                }
            }
            LocalShadowActive=true;
            LastLocalShadowRender=now;
            LastRenderedLocalPosition=LocalPosition;
            LastRenderedLocalColor=LocalColor;
        }
        finally
        {
            ShadowDepthShader?.SetUniform1i("ae_pointPass",0);
            GL.ColorMask(true,true,true,true);
            if(blend)GL.Enable(EnableCap.Blend);else GL.Disable(EnableCap.Blend);
            if(cull)GL.Enable(EnableCap.CullFace);else GL.Disable(EnableCap.CullFace);
            GL.DepthFunc((DepthFunction)depthFunction);
            GL.BindFramebuffer(FramebufferTarget.Framebuffer,framebuffer);
            GL.Viewport(viewport[0],viewport[1],viewport[2],viewport[3]);
            GL.ActiveTexture((TextureUnit)active);GL.UseProgram(program);Shader.currentHandle=program;
        }
    }
    private static void RenderShadowMap(double deltaTime)
    {
        if (!Settings.Enabled || !Settings.ShadowMaps || !Game.mainLoadDone || !Game.threadedLoadDone ||
            !Game.inGame || Game.gameState?.worldManager.world == null || MultiChunkRenderer.chunksToRender.Count == 0)
        {
            ShadowMapActive = false;
            return;
        }

        float day = (float)Game.gameState.worldManager.world.timeManager.worldTime / 86400f;
        if (SunDirection.Y < 0.02f && MoonStrength < 0.02f)
        {
            ShadowMapActive = false;
            return;
        }

        EnsureShadowResources();
        if (ShadowDepthShader == null || ShadowFramebuffer == 0)
        {
            ShadowMapActive = false;
            return;
        }

        Matrix4 sunRotation = Matrix4.Mult(Matrix4.CreateRotationX(day * MathF.PI * 2f),
            Matrix4.CreateRotationY(MathF.PI / 10f));
        Vector3 targetShadowDirection = SunDirection.Y > 0.02f ? SunDirection : MoonDirection;
        Vector3 candidateShadowDirection;
        if (!SunDirectionInitialised || Vector3.Dot(ShadowDirection, targetShadowDirection) < 0.5f)
        {
            candidateShadowDirection = targetShadowDirection;
            SunDirectionInitialised = true;
        }
        else
        {
            float sunSmoothing = 1f - MathF.Exp(-8f * (float)Math.Clamp(deltaTime, 0.0, 0.1));
            candidateShadowDirection = Vector3.Lerp(ShadowDirection, targetShadowDirection, sunSmoothing).Normalized();
        }
        float radius = Clamp(Settings.ShadowDistance, 32f, 256f);
        float texelWorldSize = radius * 2f / CurrentShadowResolution;
        Vector3 center = Game.camera.position;
        Vector3 up = Vector3.UnitZ; // Fixed basis avoids a discontinuous rotation near noon.
        Vector3 lightForward = -candidateShadowDirection;
        Vector3 lightRight = Vector3.Cross(lightForward, up).Normalized();
        Vector3 lightUp = Vector3.Cross(lightRight, lightForward).Normalized();
        float rightCoordinate = Vector3.Dot(center, lightRight);
        float upCoordinate = Vector3.Dot(center, lightUp);
        center += lightRight * (MathF.Round(rightCoordinate / texelWorldSize) * texelWorldSize - rightCoordinate);
        center += lightUp * (MathF.Round(upCoordinate / texelWorldSize) * texelWorldSize - upCoordinate);
        DateTime now=DateTime.UtcNow;
        double sinceLast=(now-LastShadowRender).TotalSeconds;
        bool stableCenter=(center-LastShadowCenter).LengthSquared<MathF.Max(texelWorldSize*texelWorldSize*9f,0.04f);
        bool stableDirection=Vector3.Dot(LastRenderedShadowDirection,candidateShadowDirection)>0.9998f;
        bool reusable=ShadowMapActive && MathF.Abs(LastShadowRadius-radius)<0.01f;
        // Shadow rendering redraws every visible chunk. Cap it at 20 Hz while moving
        // and roughly 8 Hz while the snapped camera/light state is stable.
        if(reusable && (sinceLast<0.05 || (stableCenter && stableDirection && sinceLast<0.125)))
            return;
        ShadowDirection=candidateShadowDirection;
        Vector3 eye = center + ShadowDirection * radius * 2.2f;
        Matrix4 lightView = Matrix4.LookAt(eye, center, up);
        Matrix4 lightProjection = Matrix4.CreateOrthographicOffCenter(-radius, radius, -radius, radius, 0.5f, radius * 5f);
        LightViewProjection = lightView * lightProjection;

        int previousFramebuffer;
        GL.GetInteger(GetPName.FramebufferBinding, out previousFramebuffer);
        int[] previousViewport = new int[4];
        GL.GetInteger(GetPName.Viewport, previousViewport);
        bool blendWasEnabled = GL.IsEnabled(EnableCap.Blend);
        bool cullWasEnabled = GL.IsEnabled(EnableCap.CullFace);
        int previousCullFace;
        GL.GetInteger(GetPName.CullFaceMode, out previousCullFace);

        GL.BindFramebuffer(FramebufferTarget.Framebuffer, ShadowFramebuffer);
        GL.Viewport(0, 0, CurrentShadowResolution, CurrentShadowResolution);
        GL.ColorMask(false, false, false, false);
        GL.DepthMask(true);
        GL.Enable(EnableCap.DepthTest);
        GL.Disable(EnableCap.Blend);
        GL.Disable(EnableCap.CullFace);
        GL.Enable(EnableCap.PolygonOffsetFill);
        GL.PolygonOffset(0f, 1f);
        GL.Clear(ClearBufferMask.DepthBufferBit);

        ShadowDepthShader.SetUniform1i("ae_pointPass", 0);
        ShadowDepthShader.SetUniformFloat("uTime", day);
        ShadowDepthShader.SetUniform1i("leafSway", GameSettings.leaf_sway.value ? 1 : 0);
        ShadowDepthShader.SetUniformMat4("ae_lightViewProjection", LightViewProjection);
        int drawnCasters = 0;
        foreach (Chunk chunk in MultiChunkRenderer.chunksToRender)
        {
            if ((new Vector3(chunk.posX,chunk.posY,chunk.posZ)*32f + new Vector3(16f) - center).Length > radius*2.5f + 28f)
                continue;
            if (!chunk.hasModel)
                continue;
            drawnCasters++;
            chunk.chunkModel.mesh.Draw(ShadowDepthShader, AssetManager.blockAtlas.generatedTexture,
                new Vector3(chunk.posX, chunk.posY, chunk.posZ) * 32f, 0f, true,
                AssetManager.blockAtlas.generatedTextureEmission, null!, null!, false, true, false);
        }

        GL.Disable(EnableCap.PolygonOffsetFill);
        GL.ColorMask(true, true, true, true);
        if (blendWasEnabled)
            GL.Enable(EnableCap.Blend);
        if (cullWasEnabled)
        {
            GL.Enable(EnableCap.CullFace);
            GL.CullFace((CullFaceMode)previousCullFace);
        }
        else
        {
            GL.Disable(EnableCap.CullFace);
        }
        GL.BindFramebuffer(FramebufferTarget.Framebuffer, previousFramebuffer);
        GL.Viewport(previousViewport[0], previousViewport[1], previousViewport[2], previousViewport[3]);
        ShadowMapActive = drawnCasters > 0;
        if(ShadowMapActive)
        {
            LastShadowRender=now;
            LastShadowCenter=center;
            LastRenderedShadowDirection=ShadowDirection;
            LastShadowRadius=radius;
        }
        if ((DateTime.UtcNow - LastShadowDiagnostic).TotalSeconds > 10)
        {
            LastShadowDiagnostic = DateTime.UtcNow;
            string diagnostic = $"sun day={day:F4} casters={drawnCasters} active={ShadowMapActive} direction={SunDirection}";
            Logger.Info("[Allumeria Enhanced] " + diagnostic);
            File.AppendAllText(Path.Combine(ModRoot,"shadow-diagnostics.log"),
                DateTime.UtcNow.ToString("O") + " " + diagnostic + Environment.NewLine);
        }
    }

    private static void EnsureShadowResources()
    {
        int resolution = Settings.ShadowResolution <= 1024 ? 1024 : Settings.ShadowResolution <= 2048 ? 2048 : 4096;
        if (ShadowDepthShader == null)
        {
            string root = Path.Combine(ModRoot, "shaders", "shadow");
            ShadowDepthShader = new Shader(Path.Combine(root, "shadow.vert"), Path.Combine(root, "shadow.frag"));
        }
        if (ShadowFramebuffer != 0 && CurrentShadowResolution == resolution)
            return;

        if (ShadowDepthTexture != 0)
            GL.DeleteTexture(ShadowDepthTexture);
        if (ShadowFramebuffer != 0)
            GL.DeleteFramebuffer(ShadowFramebuffer);

        CurrentShadowResolution = resolution;
        ShadowMapActive = false;
        LastShadowRender = DateTime.MinValue;
        ShadowFramebuffer = GL.GenFramebuffer();
        ShadowDepthTexture = GL.GenTexture();
        int previousActiveTexture;
        GL.GetInteger(GetPName.ActiveTexture, out previousActiveTexture);
        GL.ActiveTexture(TextureUnit.Texture6);
        GL.BindTexture(TextureTarget.Texture2D, ShadowDepthTexture);
        GL.TexImage2D(TextureTarget.Texture2D, 0, PixelInternalFormat.DepthComponent24, resolution, resolution,
            0, PixelFormat.DepthComponent, PixelType.Float, IntPtr.Zero);
        GL.TexParameter(TextureTarget.Texture2D, TextureParameterName.TextureMinFilter, (int)TextureMinFilter.Nearest);
        GL.TexParameter(TextureTarget.Texture2D, TextureParameterName.TextureMagFilter, (int)TextureMagFilter.Nearest);
        GL.TexParameter(TextureTarget.Texture2D, TextureParameterName.TextureWrapS, (int)TextureWrapMode.ClampToBorder);
        GL.TexParameter(TextureTarget.Texture2D, TextureParameterName.TextureWrapT, (int)TextureWrapMode.ClampToBorder);
        GL.TexParameter(TextureTarget.Texture2D, TextureParameterName.TextureBorderColor, new float[] { 1f, 1f, 1f, 1f });
        GL.BindFramebuffer(FramebufferTarget.Framebuffer, ShadowFramebuffer);
        GL.FramebufferTexture2D(FramebufferTarget.Framebuffer, FramebufferAttachment.DepthAttachment,
            TextureTarget.Texture2D, ShadowDepthTexture, 0);
        GL.DrawBuffer(DrawBufferMode.None);
        GL.ReadBuffer(ReadBufferMode.None);
        FramebufferErrorCode status = GL.CheckFramebufferStatus(FramebufferTarget.Framebuffer);
        GL.BindFramebuffer(FramebufferTarget.Framebuffer, 0);
        GL.ActiveTexture((TextureUnit)previousActiveTexture);
        if (status != FramebufferErrorCode.FramebufferComplete)
            throw new InvalidOperationException("Shadow framebuffer incomplete: " + status);
        Logger.Info("[Allumeria Enhanced] Shadow map created: " + resolution + "x" + resolution);
    }

    private static void RegisterGameSettings()
    {
        EnhancedCategory = new SettingsCategory("allumeria_enhanced", 688, 128);
        _ = new SettingsEntryLabel("ae_header", EnhancedCategory);
        EnabledEntry = new SettingsEntryBool("ae_enabled", EnhancedCategory, Settings.Enabled);
        ShaderPackEntry = new SettingsEntryButton("ae_shader_pack", EnhancedCategory, Settings.ShaderPack, ToggleShaderPackPicker);
        _ = new SettingsEntryButton("ae_open_shader_folder", EnhancedCategory, "Open folder", OpenShaderPackFolder);
        PresetEntry = new SettingsEntryEnum("ae_preset", EnhancedCategory, PresetIndex(Settings.Preset), 0, 3,
            new[] { "Performance", "Balanced", "Ultra", "Cinematic" });
        LastPresetIndex = PresetIndex(Settings.Preset);
        ShadowMapsEntry = new SettingsEntryBool("ae_shadow_maps", EnhancedCategory, Settings.ShadowMaps);
        ShadowResolutionEntry = new SettingsEntryEnum("ae_shadow_resolution", EnhancedCategory,
            ResolutionIndex(Settings.ShadowResolution), 0, 2, new[] { "1024", "2048", "4096" });
        ShadowDistanceEntry = new SettingsEntryInt("ae_shadow_distance", EnhancedCategory, (int)Settings.ShadowDistance, 16, 32, 256);
        ShadowStrengthEntry = new SettingsEntryInt("ae_shadow_strength", EnhancedCategory, (int)MathF.Round(Settings.ShadowStrength * 100f), 5, 0, 150);
        ShadowSoftnessEntry = new SettingsEntryInt("ae_shadow_softness", EnhancedCategory, (int)MathF.Round(Settings.ShadowSoftness * 100f), 10, 0, 200);
        ShadowBiasEntry = new SettingsEntryInt("ae_shadow_bias", EnhancedCategory, (int)MathF.Round(Settings.ShadowBias * 10000f), 1, 1, 100);
        IndirectLightEntry = new SettingsEntryInt("ae_indirect_light", EnhancedCategory, (int)MathF.Round(Settings.IndirectLight * 100f), 5, 25, 150);
        SaturationEntry = new SettingsEntryInt("ae_saturation", EnhancedCategory, (int)MathF.Round(Settings.Saturation * 100f), 5, 0, 200);
        ContrastEntry = new SettingsEntryInt("ae_contrast", EnhancedCategory, (int)MathF.Round(Settings.Contrast * 100f), 5, 50, 180);
        WarmthEntry = new SettingsEntryInt("ae_warmth", EnhancedCategory, (int)MathF.Round(Settings.Warmth * 100f), 5, -100, 100);
        FogEntry = new SettingsEntryInt("ae_fog", EnhancedCategory, (int)MathF.Round(Settings.FogStrength * 100f), 5, 0, 100);
        WaterEntry = new SettingsEntryInt("ae_water", EnhancedCategory, (int)MathF.Round(Settings.WaterRefraction * 100f), 5, 0, 200);
        CloudsEntry = new SettingsEntryInt("ae_clouds", EnhancedCategory, (int)MathF.Round(Settings.CloudSoftness * 100f), 5, 0, 100);
        ReflectionsEntry = new SettingsEntryBool("ae_reflections", EnhancedCategory, Settings.Reflections);
        ReflectionStrengthEntry = new SettingsEntryInt("ae_reflection_strength", EnhancedCategory, (int)MathF.Round(Settings.ReflectionStrength * 100f), 5, 0, 150);
        RayQualityEntry = new SettingsEntryEnum("ae_ray_quality", EnhancedCategory, RayQualityIndex(Settings.RaySteps), 0, 2,
            new[] { "Low (16)", "High (32)", "Ultra (48)" });
        PostProcessingEntry = new SettingsEntryBool("ae_post_processing", EnhancedCategory, Settings.PostProcessing);
        AmbientOcclusionEntry = new SettingsEntryInt("ae_ambient_occlusion", EnhancedCategory, (int)MathF.Round(Settings.AmbientOcclusion * 100f), 5, 0, 100);
        SharpeningEntry = new SettingsEntryInt("ae_sharpening", EnhancedCategory, (int)MathF.Round(Settings.Sharpening * 100f), 5, 0, 100);
        DepthOfFieldEntry = new SettingsEntryBool("ae_depth_of_field", EnhancedCategory, Settings.DepthOfField);
        MoonRayStrengthEntry = new SettingsEntryInt("ae_moon_rays", EnhancedCategory, (int)MathF.Round(Settings.MoonRayStrength * 100f), 5, 0, 250);
        CloudShadowStrengthEntry = new SettingsEntryInt("ae_cloud_shadows", EnhancedCategory, (int)MathF.Round(Settings.CloudShadowStrength * 100f), 1, 0, 35);
        ZoomFovEntry = new SettingsEntryInt("ae_zoom_fov", EnhancedCategory, Settings.ZoomFov, 5, 10, 70);
        _ = new SettingsEntryButton("ae_reload", EnhancedCategory, "Reload", () => ReloadRequested = true);

        ToggleChannel = new InputChannel("allumeria_enhanced_toggle", Keys.F10, InputChannel.ActionType.Both);
        PresetChannel = new InputChannel("allumeria_enhanced_preset", Keys.F9, InputChannel.ActionType.Both);
        ReloadChannel = new InputChannel("allumeria_enhanced_reload", Keys.F8, InputChannel.ActionType.Both);
        ZoomChannel = new InputChannel("allumeria_enhanced_zoom", Keys.C, InputChannel.ActionType.InGame);
    }

    private static void SyncSettingsFromMenu()
    {
        if (EnabledEntry == null)
            return;
        if (DateTime.UtcNow < MenuSyncReadyAt)
        {
            ApplySettingsToEntries();
            LastPresetIndex = PresetIndex(Settings.Preset);
            return;
        }
        Settings.Enabled = EnabledEntry.value;
        int requestedPreset = Math.Clamp(PresetEntry!.value, 0, 3);
        if (requestedPreset != LastPresetIndex)
        {
            ApplyPreset(requestedPreset);
            LastPresetIndex = requestedPreset;
            ApplySettingsToEntries();
            Notify("preset: " + Settings.Preset);
        }
        Settings.ShadowMaps = ShadowMapsEntry!.value;
        Settings.ShadowResolution = new[] { 1024, 2048, 4096 }[Math.Clamp(ShadowResolutionEntry!.value, 0, 2)];
        Settings.ShadowDistance = ShadowDistanceEntry!.value;
        Settings.ShadowStrength = ShadowStrengthEntry!.value / 100f;
        Settings.ShadowSoftness = ShadowSoftnessEntry!.value / 100f;
        Settings.ShadowBias = ShadowBiasEntry!.value / 10000f;
        Settings.IndirectLight = IndirectLightEntry!.value / 100f;
        Settings.Saturation = SaturationEntry!.value / 100f;
        Settings.Contrast = ContrastEntry!.value / 100f;
        Settings.Warmth = WarmthEntry!.value / 100f;
        Settings.FogStrength = FogEntry!.value / 100f;
        Settings.WaterRefraction = WaterEntry!.value / 100f;
        Settings.CloudSoftness = CloudsEntry!.value / 100f;
        Settings.Reflections = ReflectionsEntry!.value;
        Settings.ReflectionStrength = ReflectionStrengthEntry!.value / 100f;
        Settings.RaySteps = new[] { 16, 32, 48 }[Math.Clamp(RayQualityEntry!.value, 0, 2)];
        Settings.PostProcessing = PostProcessingEntry!.value;
        Settings.AmbientOcclusion = AmbientOcclusionEntry!.value / 100f;
        Settings.Sharpening = SharpeningEntry!.value / 100f;
        Settings.DepthOfField = DepthOfFieldEntry!.value;
        Settings.MoonRayStrength = MoonRayStrengthEntry!.value / 100f;
        Settings.CloudShadowStrength = CloudShadowStrengthEntry!.value / 100f;
        Settings.ZoomFov = ZoomFovEntry!.value;
    }

    private static void ApplySettingsToEntries()
    {
        if (EnabledEntry == null)
            return;
        EnabledEntry.value = Settings.Enabled;
        PresetEntry!.value = PresetIndex(Settings.Preset);
        ShadowMapsEntry!.value = Settings.ShadowMaps;
        ShadowResolutionEntry!.value = ResolutionIndex(Settings.ShadowResolution);
        ShadowDistanceEntry!.value = (int)Settings.ShadowDistance;
        ShadowStrengthEntry!.value = (int)MathF.Round(Settings.ShadowStrength * 100f);
        ShadowSoftnessEntry!.value = (int)MathF.Round(Settings.ShadowSoftness * 100f);
        ShadowBiasEntry!.value = (int)MathF.Round(Settings.ShadowBias * 10000f);
        IndirectLightEntry!.value = (int)MathF.Round(Settings.IndirectLight * 100f);
        SaturationEntry!.value = (int)MathF.Round(Settings.Saturation * 100f);
        ContrastEntry!.value = (int)MathF.Round(Settings.Contrast * 100f);
        WarmthEntry!.value = (int)MathF.Round(Settings.Warmth * 100f);
        FogEntry!.value = (int)MathF.Round(Settings.FogStrength * 100f);
        WaterEntry!.value = (int)MathF.Round(Settings.WaterRefraction * 100f);
        CloudsEntry!.value = (int)MathF.Round(Settings.CloudSoftness * 100f);
        ReflectionsEntry!.value = Settings.Reflections;
        ReflectionStrengthEntry!.value = (int)MathF.Round(Settings.ReflectionStrength * 100f);
        RayQualityEntry!.value = RayQualityIndex(Settings.RaySteps);
        PostProcessingEntry!.value = Settings.PostProcessing;
        AmbientOcclusionEntry!.value = (int)MathF.Round(Settings.AmbientOcclusion * 100f);
        SharpeningEntry!.value = (int)MathF.Round(Settings.Sharpening * 100f);
        DepthOfFieldEntry!.value = Settings.DepthOfField;
        MoonRayStrengthEntry!.value = (int)MathF.Round(Settings.MoonRayStrength * 100f);
        CloudShadowStrengthEntry!.value = (int)MathF.Round(Settings.CloudShadowStrength * 100f);
        ZoomFovEntry!.value = Settings.ZoomFov;
    }

    private static int PresetIndex(string preset) => preset.ToLowerInvariant() switch
    {
        "performance" => 0,
        "ultra" => 2,
        "cinematic" => 3,
        _ => 1
    };

    private static int ResolutionIndex(int resolution) => resolution <= 1024 ? 0 : resolution <= 2048 ? 1 : 2;
    private static int RayQualityIndex(int steps) => steps <= 16 ? 0 : steps <= 32 ? 1 : 2;

    private static int PackIndex(string pack)
    {
        int index = ShaderPacks.FindIndex(name => string.Equals(name, pack, StringComparison.OrdinalIgnoreCase));
        return index < 0 ? 0 : index;
    }

    private static void DiscoverShaderPacks()
    {
        if (Settings.ShaderPack == "Enhanced Smooth" || Settings.ShaderPack == "Vanilla")
            Settings.ShaderPack = "Classic";
        else if (Settings.ShaderPack == "Golden Fantasy" || Settings.ShaderPack == "Aurora Cinematic")
            Settings.ShaderPack = "Fabulous";
        ShaderPacks.Clear();
        ShaderPackIcons.Clear();
        UiIconsUploaded = false;
        string root = Path.Combine(ModRoot, "shaderpacks");
        Directory.CreateDirectory(root);
        foreach (string directory in Directory.GetDirectories(root))
        {
            if (Directory.Exists(Path.Combine(directory, "shaders")))
                ShaderPacks.Add(Path.GetFileName(directory));
        }
        ShaderPacks.Sort((a, b) =>
        {
            if (a.Equals("Classic", StringComparison.OrdinalIgnoreCase)) return -1;
            if (b.Equals("Classic", StringComparison.OrdinalIgnoreCase)) return 1;
            return string.Compare(a, b, StringComparison.OrdinalIgnoreCase);
        });
        if (ShaderPacks.Count == 0)
            ShaderPacks.Add("Classic");
        for (int i = 0; i < ShaderPacks.Count; ++i)
            ShaderPackIcons[ShaderPacks[i]] = (688, 144 + i * 16);
        if (PackIndex(Settings.ShaderPack) == 0 && !ShaderPacks[0].Equals(Settings.ShaderPack, StringComparison.OrdinalIgnoreCase))
            Settings.ShaderPack = ShaderPacks[0];
    }

    private static PackManifest? ReadPackManifest(string pack)
    {
        string path = Path.Combine(ModRoot, "shaderpacks", pack, "pack.json");
        if (!File.Exists(path)) return null;
        try { return JsonSerializer.Deserialize<PackManifest>(File.ReadAllText(path), JsonOptions); }
        catch (Exception ex) { Logger.Error("[Allumeria Enhanced] Invalid pack manifest " + pack + ": " + ex.Message); return null; }
    }

    private static void ApplyPackDefaults(string pack)
    {
        var values = ReadPackManifest(pack)?.Settings;
        if (values == null) return;
        foreach (var pair in values)
        {
            JsonElement v = pair.Value;
            switch (pair.Key.ToLowerInvariant())
            {
                case "postprocessing": Settings.PostProcessing = v.GetBoolean(); break;
                case "ambientocclusion": Settings.AmbientOcclusion = v.GetSingle(); break;
                case "sharpening": Settings.Sharpening = v.GetSingle(); break;
                case "depthoffield": Settings.DepthOfField = v.GetBoolean(); break;
                case "moonraystrength": Settings.MoonRayStrength = v.GetSingle(); break;
                case "cloudshadowstrength": Settings.CloudShadowStrength = v.GetSingle(); break;
                case "shadowmaps": Settings.ShadowMaps = v.GetBoolean(); break;
                case "shadowresolution": Settings.ShadowResolution = v.GetInt32(); break;
                case "shadowdistance": Settings.ShadowDistance = v.GetSingle(); break;
                case "shadowstrength": Settings.ShadowStrength = v.GetSingle(); break;
                case "shadowsoftness": Settings.ShadowSoftness = v.GetSingle(); break;
                case "shadowbias": Settings.ShadowBias = v.GetSingle(); break;
                case "indirectlight": Settings.IndirectLight = v.GetSingle(); break;
                case "saturation": Settings.Saturation = v.GetSingle(); break;
                case "contrast": Settings.Contrast = v.GetSingle(); break;
                case "warmth": Settings.Warmth = v.GetSingle(); break;
                case "fogstrength": Settings.FogStrength = v.GetSingle(); break;
                case "waterrefraction": Settings.WaterRefraction = v.GetSingle(); break;
                case "cloudsoftness": Settings.CloudSoftness = v.GetSingle(); break;
                case "reflections": Settings.Reflections = v.GetBoolean(); break;
                case "reflectionstrength": Settings.ReflectionStrength = v.GetSingle(); break;
                case "raysteps": Settings.RaySteps = v.GetInt32(); break;
            }
        }
    }

    private static void EnsureUiIcons()
    {
        if (UiIconsUploaded || !Game.mainLoadDone || Drawing.uiTexture == null) return;
        if ((DateTime.UtcNow - LastUiIconAttempt).TotalSeconds < 2.0) return;
        LastUiIconAttempt = DateTime.UtcNow;

        bool uploaded = UploadUiIcon(Path.Combine(ModRoot, "assets", "allumeria-enhanced-icon.png"), 688, 128);
        foreach (string pack in ShaderPacks)
        {
            var manifest = ReadPackManifest(pack);
            string iconName = string.IsNullOrWhiteSpace(manifest?.Icon) ? "icon.png" : manifest!.Icon!;
            if (ShaderPackIcons.TryGetValue(pack, out var slot))
                uploaded &= UploadUiIcon(Path.Combine(ModRoot, "shaderpacks", pack, iconName), slot.x, slot.y);
        }
        UiIconsUploaded = uploaded;
        if (UiIconsUploaded)
            Logger.Info("[Allumeria Enhanced] UI icons uploaded successfully.");
    }

    private static bool UploadUiIcon(string path, int atlasX, int atlasY)
    {
        if (!File.Exists(path))
        {
            Logger.Error("[Allumeria Enhanced] UI icon is missing: " + path);
            return false;
        }
        Texture? icon = null;
        int previousActive = 0, previousTexture = 0;
        try
        {
            GL.GetInteger(GetPName.ActiveTexture, out previousActive);
            GL.ActiveTexture(TextureUnit.Texture0);
            GL.GetInteger(GetPName.TextureBinding2D, out previousTexture);
            icon = new Texture(path, flip: true, clamp: true, mipmaps: false, keepImage: true, nearest: true, upload: false);
            if (icon.sourceImage == null) return false;
            byte[] pixels = ResizeNearest(icon.sourceImage.Data, icon.sourceImage.Width, icon.sourceImage.Height, 16, 16);
            int uploadY = (int)Drawing.uiTexture.height - atlasY - 16;
            if (atlasX < 0 || uploadY < 0 || atlasX + 16 > Drawing.uiTexture.width || uploadY + 16 > Drawing.uiTexture.height)
                throw new InvalidOperationException($"UI atlas slot is outside the texture: logical=({atlasX},{atlasY}), upload=({atlasX},{uploadY}), atlas={Drawing.uiTexture.width}x{Drawing.uiTexture.height}");
            GL.BindTexture(TextureTarget.Texture2D, Drawing.uiTexture.id);
            GL.PixelStore(PixelStoreParameter.UnpackAlignment, 1);
            GL.GetError();
            GL.TexSubImage2D(TextureTarget.Texture2D, 0, atlasX, uploadY, 16, 16, PixelFormat.Rgba, PixelType.UnsignedByte, pixels);
            OpenTK.Graphics.OpenGL4.ErrorCode error = GL.GetError();
            if (error != OpenTK.Graphics.OpenGL4.ErrorCode.NoError)
                throw new InvalidOperationException("OpenGL rejected UI icon upload: " + error);
            Logger.Info($"[Allumeria Enhanced] UI icon loaded: {Path.GetFileName(path)} -> ({atlasX},{atlasY})");
            return true;
        }
        catch (Exception ex)
        {
            Logger.Error("[Allumeria Enhanced] Could not upload UI icon " + path + ": " + ex);
            return false;
        }
        finally
        {
            if (icon != null) icon.Delete();
            Texture.slots[0] = -1;
            GL.BindTexture(TextureTarget.Texture2D, previousTexture);
            GL.ActiveTexture((TextureUnit)previousActive);
        }
    }

    private static byte[] ResizeNearest(byte[] source, int sourceWidth, int sourceHeight, int width, int height)
    {
        byte[] result = new byte[width * height * 4];
        for (int y = 0; y < height; ++y) for (int x = 0; x < width; ++x)
        {
            int sx = Math.Clamp(x * sourceWidth / width, 0, sourceWidth - 1);
            int sy = Math.Clamp(y * sourceHeight / height, 0, sourceHeight - 1);
            System.Buffer.BlockCopy(source, (sx + sy * sourceWidth) * 4, result, (x + y * width) * 4, 4);
        }
        return result;
    }

    private static void ApplyPreset(int preset)
    {
        if (preset == 0)
        {
            Settings.Preset = "Performance"; Settings.ShadowResolution = 1024; Settings.ShadowDistance = 72f;
            Settings.ShadowStrength = 0.85f; Settings.ShadowSoftness = 0.35f; Settings.IndirectLight = 0.85f;
            Settings.Saturation = 1.00f; Settings.Contrast = 1.08f; Settings.Warmth = 0.00f;
            Settings.FogStrength = 0.65f; Settings.WaterRefraction = 0.55f; Settings.CloudSoftness = 0.35f;
            Settings.ReflectionStrength = 0.50f; Settings.RaySteps = 16;
        }
        else if (preset == 2)
        {
            Settings.Preset = "Ultra"; Settings.ShadowResolution = 4096; Settings.ShadowDistance = 112f;
            Settings.ShadowStrength = 0.95f; Settings.ShadowSoftness = 0.70f; Settings.IndirectLight = 0.80f;
            Settings.Saturation = 1.02f; Settings.Contrast = 1.12f; Settings.Warmth = 0.02f;
            Settings.FogStrength = 0.82f; Settings.WaterRefraction = 0.90f; Settings.CloudSoftness = 0.55f;
            Settings.ReflectionStrength = 0.95f; Settings.RaySteps = 48;
        }
        else if (preset == 3)
        {
            Settings.Preset = "Cinematic"; Settings.ShadowResolution = 4096; Settings.ShadowDistance = 144f;
            Settings.ShadowStrength = 1.00f; Settings.ShadowSoftness = 0.90f; Settings.IndirectLight = 0.75f;
            Settings.Saturation = 1.04f; Settings.Contrast = 1.15f; Settings.Warmth = 0.05f;
            Settings.FogStrength = 0.90f; Settings.WaterRefraction = 1.00f; Settings.CloudSoftness = 0.62f;
            Settings.ReflectionStrength = 1.05f; Settings.RaySteps = 48;
        }
        else
        {
            Settings.Preset = "Balanced"; Settings.ShadowResolution = 2048; Settings.ShadowDistance = 96f;
            Settings.ShadowStrength = 0.90f; Settings.ShadowSoftness = 0.55f; Settings.IndirectLight = 0.82f;
            Settings.Saturation = 1.00f; Settings.Contrast = 1.10f; Settings.Warmth = 0.00f;
            Settings.FogStrength = 0.78f; Settings.WaterRefraction = 0.75f; Settings.CloudSoftness = 0.48f;
            Settings.ReflectionStrength = 0.78f; Settings.RaySteps = 32;
        }
    }

    private static void EnsureEnglishTranslations()
    {
        string path = Path.Combine(Directory.GetCurrentDirectory(), "res", "translations", "en-AU", "keys.txt");
        if (!File.Exists(path))
            return;
        string existing = File.ReadAllText(path);
        string lines = "settings_category.allumeria_enhanced Allumeria Enhanced\n" +
            "settings.ae_header SHADERS, REFLECTIONS AND SHADOW MAP\nsettings.ae_enabled Enabled\nsettings.ae_shader_pack Shader pack\nsettings.ae_preset Preset\n" +
            "settings.ae_open_shader_folder Shader pack folder\n" +
            "settings.ae_shadow_maps Shadow map\nsettings.ae_shadow_resolution Shadow resolution\n" +
            "settings.ae_shadow_distance Shadow distance\nsettings.ae_shadow_strength Shadow strength (%)\n" +
            "settings.ae_shadow_softness Shadow softness (%)\nsettings.ae_shadow_bias Shadow bias\n" +
            "settings.ae_indirect_light Indirect light (%)\nsettings.ae_saturation Saturation (%)\n" +
            "settings.ae_contrast Contrast (%)\nsettings.ae_warmth Warmth (%)\nsettings.ae_fog Fog strength (%)\n" +
            "settings.ae_water Water refraction (%)\nsettings.ae_clouds Cloud softness (%)\nsettings.ae_reflections Ray-marched reflections (SSR)\n" +
            "settings.ae_reflection_strength Reflection strength (%)\nsettings.ae_ray_quality Ray-marched reflection quality\nsettings.ae_zoom_fov Zoom field of view\n" +
            "settings.ae_post_processing Aurora post-processing\nsettings.ae_ambient_occlusion Ambient occlusion (%)\nsettings.ae_sharpening Sharpening (%)\n" +
            "settings.ae_depth_of_field Depth of field\nsettings.ae_moon_rays Moon god rays (%)\nsettings.ae_cloud_shadows Cloud shadow strength (%)\n" +
            "settings.ae_reload Reload shader settings\nkeybind.allumeria_enhanced_toggle Toggle enhanced shaders\n" +
            "keybind.allumeria_enhanced_preset Cycle shader preset\nkeybind.allumeria_enhanced_reload Reload shader settings\n" +
            "keybind.allumeria_enhanced_zoom Hold to zoom (wheel adjusts)\n";
        bool changed = false;
        foreach (string line in lines.Split('\n', StringSplitOptions.RemoveEmptyEntries))
        {
            string key = line.Split(' ', 2)[0] + " ";
            int start = existing.IndexOf(key, StringComparison.Ordinal);
            if (start < 0)
            {
                existing += "\n" + line;
                changed = true;
                continue;
            }

            int end = existing.IndexOf('\n', start);
            if (end < 0)
                end = existing.Length;
            string current = existing.Substring(start, end - start).TrimEnd('\r');
            if (current == line)
                continue;
            existing = existing.Remove(start, end - start).Insert(start, line);
            changed = true;
        }
        if (changed)
            File.WriteAllText(path, existing);
    }

    private static void DeployShaders()
    {
        string target = Path.Combine(Directory.GetCurrentDirectory(), "res", "shaders");
        string baseline = Path.Combine(ModRoot, "original-shaders");
        string source = Path.Combine(ModRoot, "shaderpacks", Settings.ShaderPack, "shaders");
        CopyShaderTree(baseline, target);
        CopyShaderTree(source, target);
        Logger.Info("[Allumeria Enhanced] Shader pack deployed: " + Settings.ShaderPack);
    }

    private static void CopyShaderTree(string source, string target)
    {
        if (!Directory.Exists(source))
            return;
        foreach (string file in Directory.GetFiles(source, "*", SearchOption.AllDirectories))
        {
            string relative = Path.GetRelativePath(source, file);
            string destination = Path.Combine(target, relative);
            Directory.CreateDirectory(Path.GetDirectoryName(destination)!);
            File.Copy(file, destination, overwrite: true);
        }
    }

    private static void LoadSettings(bool writeDefaults)
    {
        try
        {
            if (File.Exists(ConfigPath))
                Settings = JsonSerializer.Deserialize<ShaderSettings>(File.ReadAllText(ConfigPath), JsonOptions) ?? new ShaderSettings();
            else if (writeDefaults)
            {
                ApplyPreset(1);
            }
            if (writeDefaults)
                SaveSettings();
            ConfigWriteTime = File.Exists(ConfigPath) ? File.GetLastWriteTimeUtc(ConfigPath) : DateTime.MinValue;
            LastSettingsSignature = JsonSerializer.Serialize(Settings, JsonOptions);
        }
        catch (Exception ex)
        {
            Logger.Error("[Allumeria Enhanced] Settings load failed: " + ex.Message);
        }
    }

    private static void SaveSettings()
    {
        Directory.CreateDirectory(Path.GetDirectoryName(ConfigPath)!);
        string json = JsonSerializer.Serialize(Settings, JsonOptions);
        File.WriteAllText(ConfigPath, json);
        LastSettingsSignature = json;
        ConfigWriteTime = File.GetLastWriteTimeUtc(ConfigPath);
    }

    private static void Notify(string message)
    {
        Logger.Info("[Allumeria Enhanced] " + message);
        try { if (Game.inGame) ChatLog.NewMessageSystem("Allumeria Enhanced: " + message); } catch { }
    }

    private static float Clamp(float value, float min, float max) => MathF.Max(min, MathF.Min(max, value));
}

public sealed class MarqueeShaderPackButton : UIButton
{
    private string fullText;
    private DateTime changedAt = DateTime.UtcNow;

    public MarqueeShaderPackButton(string publicName, string text) : base(publicName, 0, 0, 20, 20, text)
    {
        fullText = text;
    }

    public void SetFullText(string text)
    {
        if (fullText == text)
            return;
        fullText = text;
        changedAt = DateTime.UtcNow;
    }

    public override void Update()
    {
        int availableWidth = Math.Max(w - 24, 8);
        if (TextRenderer.GetTextWidth(fullText, TextFont.main) <= availableWidth)
        {
            displayText = fullText;
        }
        else
        {
            double elapsed = (DateTime.UtcNow - changedAt).TotalSeconds;
            if (elapsed < 1.5)
                displayText = FittingWindow(fullText, 0, availableWidth);
            else
            {
                string cycle = fullText + "   ";
                int step = (int)((elapsed - 1.5) * 7.0) % cycle.Length;
                int start = (cycle.Length - step) % cycle.Length;
                displayText = FittingWindow(cycle, start, availableWidth);
            }
        }
        base.Update();
    }

    private static string FittingWindow(string cycle, int start, int availableWidth)
    {
        string result = "";
        for (int i = 0; i < cycle.Length; ++i)
        {
            char next = cycle[(start + i) % cycle.Length];
            string candidate = result + next;
            if (TextRenderer.GetTextWidth(candidate, TextFont.main) > availableWidth)
                break;
            result = candidate;
        }
        return result;
    }
}

public sealed class ShaderSettings
{
    public bool Enabled { get; set; } = true;
    public string ShaderPack { get; set; } = "Classic";
    public string Preset { get; set; } = "Balanced";
    public bool PostProcessing { get; set; } = true;
    public float AmbientOcclusion { get; set; } = 0.55f;
    public float Sharpening { get; set; } = 0.35f;
    public bool DepthOfField { get; set; } = false;
    public float MoonRayStrength { get; set; } = 1.35f;
    public float CloudShadowStrength { get; set; } = 0.14f;
    public bool ShadowMaps { get; set; } = true;
    public int ShadowResolution { get; set; } = 2048;
    public float ShadowDistance { get; set; } = 96f;
    public float ShadowStrength { get; set; } = 0.90f;
    public float ShadowSoftness { get; set; } = 0.55f;
    public float ShadowBias { get; set; } = 0.0004f;
    public float IndirectLight { get; set; } = 0.82f;
    public float Saturation { get; set; } = 1.00f;
    public float Contrast { get; set; } = 1.10f;
    public float Warmth { get; set; } = 0.00f;
    public float FogStrength { get; set; } = 0.78f;
    public float WaterRefraction { get; set; } = 0.75f;
    public float CloudSoftness { get; set; } = 0.48f;
    public bool Reflections { get; set; } = true;
    public float ReflectionStrength { get; set; } = 0.78f;
    public int RaySteps { get; set; } = 32;
    public int ZoomFov { get; set; } = 30;
}

public sealed class PackManifest
{
    public string? Name { get; set; }
    public string? Version { get; set; }
    public string? Description { get; set; }
    public string? Icon { get; set; }
    public Dictionary<string, JsonElement>? Settings { get; set; }
}
