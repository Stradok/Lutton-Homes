<?php
defined( 'ABSPATH' ) || exit;

get_header();
?>
<main id="content">
	<section class="lh-section">
		<div class="lh-wrap">
			<h1>We could not find that page</h1>
			<p>The address may be mistyped, or the page may have moved.</p>
			<div class="lh-actions">
				<a class="lh-link" href="<?php echo esc_url( home_url( '/' ) ); ?>">Back to the home page</a>
				<a class="lh-button lh-button--primary" href="<?php echo esc_url( lh_whatsapp_url() ); ?>">Message us on WhatsApp</a>
			</div>
		</div>
	</section>
</main>
<?php
get_footer();
