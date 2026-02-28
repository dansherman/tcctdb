<script lang="ts">
	import '../app.css';

	let { children } = $props();
</script>

<header id="site_title">
	<div>
		<a href="/">TCCTDB</a>
	</div>
</header>
<main>
	{@render children()}
</main>
<footer>
	A project of 4 Community Theater
</footer>
