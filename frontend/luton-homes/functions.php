<?php
defined( 'ABSPATH' ) || exit;

const LH_WHATSAPP_NUMBER = '447934586612';

function lh_setup() {
	add_theme_support( 'title-tag' );
	add_theme_support( 'post-thumbnails' );
	add_theme_support( 'html5', array( 'search-form', 'comment-form', 'comment-list', 'gallery', 'caption', 'style', 'script' ) );
}
add_action( 'after_setup_theme', 'lh_setup' );

function lh_enqueue_styles() {
	wp_enqueue_style( 'luton-homes', get_stylesheet_uri(), array(), wp_get_theme()->get( 'Version' ) );
}
add_action( 'wp_enqueue_scripts', 'lh_enqueue_styles' );

// The emoji loader fetches images from s.w.org in browsers without emoji support. This site makes no third-party requests.
remove_action( 'wp_head', 'print_emoji_detection_script', 7 );
remove_action( 'wp_print_styles', 'print_emoji_styles' );

function lh_whatsapp_url( string $text = '' ): string {
	$url = 'https://wa.me/' . LH_WHATSAPP_NUMBER;
	return '' === $text ? $url : $url . '?text=' . rawurlencode( $text );
}

function lh_enqueue_scripts() {
	if ( ! is_front_page() ) {
		return;
	}
	wp_enqueue_script(
		'luton-homes-whatsapp-search',
		get_theme_file_uri( 'assets/js/whatsapp-search.js' ),
		array(),
		wp_get_theme()->get( 'Version' ),
		array( 'in_footer' => true, 'strategy' => 'defer' )
	);
}
add_action( 'wp_enqueue_scripts', 'lh_enqueue_scripts' );

// Preloads the two fonts used above the fold. The URLs match the @font-face sources in style.css.
function lh_preload_fonts() {
	foreach ( array( 'archivo-latin-700-wdth112.woff2', 'atkinson-hyperlegible-latin-400.woff2' ) as $file ) {
		printf( '<link rel="preload" href="%s" as="font" type="font/woff2" crossorigin>' . "\n", esc_url( get_theme_file_uri( 'assets/fonts/' . $file ) ) );
	}
}
add_action( 'wp_head', 'lh_preload_fonts', 1 );
