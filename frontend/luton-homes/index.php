<?php
defined( 'ABSPATH' ) || exit;

get_header();
?>
<main id="content">
	<?php if ( is_archive() || is_search() ) : ?>
		<h1><?php the_archive_title(); ?></h1>
	<?php endif; ?>
	<?php if ( have_posts() ) : ?>
		<?php $lh_title_tag = is_singular() ? 'h1' : 'h2'; ?>
		<?php while ( have_posts() ) : the_post(); ?>
			<article id="post-<?php the_ID(); ?>" <?php post_class(); ?>>
				<<?php echo esc_html( $lh_title_tag ); ?>><a href="<?php echo esc_url( get_permalink() ); ?>"><?php the_title(); ?></a></<?php echo esc_html( $lh_title_tag ); ?>>
				<?php the_excerpt(); ?>
			</article>
		<?php endwhile; ?>
	<?php else : ?>
		<p><?php esc_html_e( 'Nothing here yet.', 'luton-homes' ); ?></p>
	<?php endif; ?>
</main>
<?php
get_footer();
