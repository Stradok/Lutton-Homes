<?php
defined( 'ABSPATH' ) || exit;
?>
<!doctype html>
<html <?php language_attributes(); ?>>
<head>
	<meta charset="<?php bloginfo( 'charset' ); ?>">
	<meta name="viewport" content="width=device-width, initial-scale=1">
	<?php wp_head(); ?>
</head>
<body <?php body_class( 'lh-theme' ); ?>>
<?php wp_body_open(); ?>
<a class="lh-skip-link" href="#content">Skip to content</a>
<header class="lh-header">
	<a class="lh-wordmark" href="<?php echo esc_url( home_url( '/' ) ); ?>">Luton Homes</a>
	<nav class="lh-nav" aria-label="Main">
		<a href="<?php echo esc_url( home_url( '/#homes' ) ); ?>">Homes</a>
		<a href="<?php echo esc_url( home_url( '/#why-direct' ) ); ?>">Why book direct</a>
		<a href="<?php echo esc_url( home_url( '/#contact' ) ); ?>">Contact</a>
	</nav>
	<a class="lh-button lh-button--primary lh-header-cta" href="<?php echo esc_url( lh_whatsapp_url() ); ?>" aria-label="Message us on WhatsApp"><span class="lh-cta-long">Message us on WhatsApp</span><span class="lh-cta-short">WhatsApp</span></a>
</header>
