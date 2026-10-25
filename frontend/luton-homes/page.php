<?php
defined( 'ABSPATH' ) || exit;

get_header();
?>
<main id="content">
	<?php while ( have_posts() ) : the_post(); ?>
		<section class="lh-section">
			<div class="lh-wrap">
				<h1><?php echo esc_html( lh_post_title( get_the_ID() ) ); ?></h1>
				<div class="lh-prose"><?php the_content(); ?></div>
			</div>
		</section>
	<?php endwhile; ?>
</main>
<?php
get_footer();
