<?php
defined( 'ABSPATH' ) || exit;

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
