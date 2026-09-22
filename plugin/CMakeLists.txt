# The fx-mic chain as a plugin.
#
# JUCE arrives through FetchContent so a clone needs nothing installed but
# cmake and a compiler — no Projucer, no full Xcode. The version is pinned:
# a plugin that builds today and not in a year is worse than no plugin.
cmake_minimum_required(VERSION 3.22)

# Before project(), not after: project() seeds both of these into the cache
# itself, and a later `set(... CACHE)` is then a no-op. Set below, the build
# silently comes out arm64-only — which loads in a native host and not in one
# running under Rosetta.
set(CMAKE_OSX_DEPLOYMENT_TARGET "11.0" CACHE STRING "")
set(CMAKE_OSX_ARCHITECTURES "arm64;x86_64" CACHE STRING "")

project(MicGnomePlugin VERSION 0.1.0 LANGUAGES C CXX)

set(CMAKE_CXX_STANDARD 20)
set(CMAKE_CXX_STANDARD_REQUIRED ON)

include(FetchContent)
FetchContent_Declare(JUCE
    GIT_REPOSITORY https://github.com/juce-framework/JUCE.git
    GIT_TAG 8.0.15
    GIT_SHALLOW TRUE)
FetchContent_MakeAvailable(JUCE)

juce_add_plugin(MicGnome
    PRODUCT_NAME "Mic Gnome"
    COMPANY_NAME "Mic Gnome"
    BUNDLE_ID com.micgnome.plugin
    PLUGIN_MANUFACTURER_CODE Mgnm
    PLUGIN_CODE Mgn1
    FORMATS VST3 AU Standalone
    IS_SYNTH FALSE
    NEEDS_MIDI_INPUT FALSE
    NEEDS_MIDI_OUTPUT FALSE
    IS_MIDI_EFFECT FALSE
    EDITOR_WANTS_KEYBOARD_FOCUS FALSE
    COPY_PLUGIN_AFTER_BUILD TRUE
    VST3_CATEGORIES Fx Distortion Modulation
    AU_MAIN_TYPE kAudioUnitType_Effect)

juce_generate_juce_header(MicGnome)

target_sources(MicGnome PRIVATE
    Source/PluginProcessor.cpp
    Source/PluginEditor.cpp
    Source/Chain.cpp
    Source/Pack.cpp)

target_compile_definitions(MicGnome PUBLIC
    JUCE_WEB_BROWSER=0
    JUCE_USE_CURL=0
    JUCE_VST3_CAN_REPLACE_VST2=0
    JUCE_DISPLAY_SPLASH_SCREEN=0)

target_link_libraries(MicGnome PRIVATE
    juce::juce_audio_utils
    juce::juce_dsp
  PUBLIC
    juce::juce_recommended_config_flags
    juce::juce_recommended_lto_flags
    juce::juce_recommended_warning_flags)
