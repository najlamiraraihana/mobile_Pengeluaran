import { useEffect, useRef, useState } from 'react';
import {
	ActivityIndicator,
	Alert,
	BackHandler,
	FlatList,
	KeyboardAvoidingView,
	Platform,
	Pressable,
	ScrollView,
	StatusBar,
	StyleSheet,
	Text,
	TextInput,
	View,
} from 'react-native';
import { SafeAreaProvider, SafeAreaView } from 'react-native-safe-area-context';
import { api } from './src/api';
import { rupiah, tanggalLokal, validate } from './src/helpers';

const COLORS = {
	ink: '#173B37',
	muted: '#71827D',
	teal: '#087F70',
	tealDark: '#075E54',
	mint: '#DDF3EC',
	canvas: '#F4F8F5',
	white: '#FFFFFF',
	line: '#DFE9E4',
	danger: '#B8473E',
};

function ActionButton({ title, onPress, disabled, kind = 'primary' }) {
	return (
		<Pressable
			accessibilityRole="button"
			disabled={disabled}
			onPress={onPress}
			style={({ pressed }) => [
				styles.button,
				kind === 'secondary' && styles.buttonSecondary,
				kind === 'danger' && styles.buttonDanger,
				pressed && !disabled && styles.buttonPressed,
				disabled && styles.disabled,
			]}
		>
			<Text
				style={[
					styles.buttonText,
					kind === 'secondary' && styles.buttonSecondaryText,
					kind === 'danger' && styles.buttonDangerText,
				]}
			>
				{title}
			</Text>
		</Pressable>
	);
}

function Message({ children, isError = false }) {
	if (!children) return null;
	return (
		<View style={[styles.message, isError && styles.errorMessage]}>
			<Text accessibilityRole={isError ? 'alert' : undefined} style={isError ? styles.errorText : styles.messageText}>
				{children}
			</Text>
		</View>
	);
}

export default function App() {
	return (
		<SafeAreaProvider>
			<ExpenseApp />
		</SafeAreaProvider>
	);
}

function ExpenseApp() {
	const [screen, setScreen] = useState('list');
	const [items, setItems] = useState([]);
	const [categories, setCategories] = useState([]);
	const [selected, setSelected] = useState(null);
	const [loading, setLoading] = useState(false);
	const [busy, setBusy] = useState(false);
	const [error, setError] = useState('');
	const [judul, setJudul] = useState('');
	const [nominal, setNominal] = useState('');
	const [categoryId, setCategoryId] = useState(null);
	const lock = useRef(false);

	async function load() {
		if (lock.current) return;
		lock.current = true;
		setLoading(true);
		setError('');
		try {
			const rows = await api.list();
			if (!Array.isArray(rows)) throw new Error('Respons daftar bukan array');
			setItems(rows);
		} catch (requestError) {
			setError(requestError.message);
		} finally {
			lock.current = false;
			setLoading(false);
		}
	}

	useEffect(() => {
		load();
	}, []);

	function goBack() {
		if (lock.current) return;
		setError('');
		setScreen(screen === 'edit' ? 'detail' : 'list');
	}

	useEffect(() => {
		const subscription = BackHandler.addEventListener('hardwareBackPress', () => {
			if (screen === 'list' && !lock.current) return false;
			goBack();
			return true;
		});
		return () => subscription.remove();
	}, [screen]);

	async function openDetail(id) {
		if (lock.current) return;
		lock.current = true;
		setBusy(true);
		setError('');
		try {
			const row = await api.detail(id);
			setSelected(row);
			setScreen('detail');
		} catch (requestError) {
			setError(requestError.message);
		} finally {
			lock.current = false;
			setBusy(false);
		}
	}

	async function openCreate() {
		if (lock.current) return;
		lock.current = true;
		setBusy(true);
		setError('');
		try {
			const rows = await api.categories();
			if (!Array.isArray(rows)) throw new Error('Respons kategori bukan array');
			setCategories(rows);
			setJudul('');
			setNominal('');
			setCategoryId(null);
			setScreen('create');
		} catch (requestError) {
			setError(requestError.message);
		} finally {
			lock.current = false;
			setBusy(false);
		}
	}

	function openEdit() {
		if (!selected) return;
		setJudul(selected.judul ?? '');
		setNominal(String(selected.nominal ?? ''));
		setError('');
		setScreen('edit');
	}

	async function save() {
		if (lock.current) return;
		const validationMessage = validate(judul, nominal);
		if (validationMessage) {
			setError(validationMessage);
			return;
		}

		lock.current = true;
		setBusy(true);
		setError('');
		let saved = false;
		try {
			const body = { judul: judul.trim(), nominal: Number(nominal) };
			if (screen === 'create') {
				await api.create({ ...body, id_kategori: categoryId });
			} else {
				await api.update(selected.id, body);
			}
			saved = true;
			setScreen('list');
			setSelected(null);
			const rows = await api.list();
			if (!Array.isArray(rows)) throw new Error('Respons daftar bukan array');
			setItems(rows);
		} catch (requestError) {
			setError(
				saved
					? `Data tersimpan. Muat ulang daftar: ${requestError.message}`
					: `${requestError.message}. Jika koneksi terputus, periksa daftar sebelum mengulang.`,
			);
			if (saved) setScreen('list');
		} finally {
			lock.current = false;
			setBusy(false);
		}
	}

	async function remove() {
		if (lock.current || !selected) return;
		lock.current = true;
		setBusy(true);
		setError('');
		let deleted = false;
		try {
			await api.remove(selected.id);
			deleted = true;
			setScreen('list');
			setSelected(null);
			const rows = await api.list();
			if (!Array.isArray(rows)) throw new Error('Respons daftar bukan array');
			setItems(rows);
		} catch (requestError) {
			setError(deleted ? `Data terhapus. Muat ulang daftar: ${requestError.message}` : requestError.message);
			if (deleted) setScreen('list');
		} finally {
			lock.current = false;
			setBusy(false);
		}
	}

	function confirmDelete() {
		if (!selected) return;
		Alert.alert('Hapus pengeluaran?', `Data "${selected.judul}" akan dihapus.`, [
			{ text: 'Batal', style: 'cancel' },
			{ text: 'Hapus', style: 'destructive', onPress: remove },
		]);
	}

	const disabled = loading || busy;
	const total = items.reduce((sum, item) => sum + Number(item.nominal || 0), 0);
	const screenTitle = {
		list: 'Pengeluaran',
		detail: 'Detail pengeluaran',
		create: 'Tambah pengeluaran',
		edit: 'Ubah pengeluaran',
	}[screen];

	return (
		<SafeAreaView style={styles.page} edges={['top', 'left', 'right', 'bottom']}>
			<StatusBar barStyle="dark-content" backgroundColor={COLORS.canvas} />
			<KeyboardAvoidingView
				style={styles.flex}
				behavior={Platform.OS === 'ios' ? 'padding' : undefined}
			>
				<View style={styles.header}>
					{screen !== 'list' ? (
						<Pressable accessibilityRole="button" onPress={goBack} disabled={disabled} style={styles.backButton}>
							<Text style={styles.backText}>Kembali</Text>
						</Pressable>
					) : (
						<Text style={styles.eyebrow}>CATATAN HARIAN</Text>
					)}
					<Text style={styles.heading}>{screenTitle}</Text>
				</View>

				{!!error && (
					<View style={styles.errorWrap}>
						<Message isError>{error}</Message>
						{screen === 'list' && (
							<Pressable onPress={load} disabled={disabled} accessibilityRole="button">
								<Text style={styles.retryText}>Coba muat ulang</Text>
							</Pressable>
						)}
					</View>
				)}

				{disabled && (
					<View style={styles.loadingRow}>
						<ActivityIndicator color={COLORS.teal} />
						<Text style={styles.loadingText}>{loading ? 'Memuat data...' : 'Memproses...'}</Text>
					</View>
				)}

				{screen === 'list' && (
					<>
						<View style={styles.summary}>
							<View>
								<Text style={styles.summaryLabel}>Total tercatat</Text>
								<Text style={styles.summaryAmount}>{rupiah(total)}</Text>
							</View>
							<View style={styles.countBadge}>
								<Text style={styles.countValue}>{items.length}</Text>
								<Text style={styles.countLabel}>catatan</Text>
							</View>
						</View>

						<View style={styles.sectionHeader}>
							<Text style={styles.sectionTitle}>Riwayat</Text>
							<Pressable accessibilityRole="button" onPress={load} disabled={disabled}>
								<Text style={styles.refreshText}>Muat ulang</Text>
							</Pressable>
						</View>

						<FlatList
							style={styles.flex}
							contentContainerStyle={items.length ? styles.listContent : styles.emptyListContent}
							data={items}
							keyExtractor={(item) => String(item.id)}
							refreshing={loading}
							onRefresh={load}
							ListEmptyComponent={
								!loading && !error ? (
									<View style={styles.emptyState}>
										<View style={styles.emptyArt}>
											<View style={styles.emptyPaper}>
												<View style={styles.emptyPaperLine} />
												<View style={[styles.emptyPaperLine, styles.emptyPaperLineShort]} />
											</View>
											<View style={styles.emptyPlusBadge}><Text style={styles.emptyMarkText}>+</Text></View>
										</View>
										<Text style={styles.emptyTitle}>Belum ada pengeluaran</Text>
										<Text style={styles.emptyBody}>Mulai catat pengeluaran pertamamu. Daftarnya akan muncul di sini.</Text>
										<View style={styles.emptyAction}>
											<ActionButton title="Catat pengeluaran pertama" onPress={openCreate} disabled={disabled} />
										</View>
									</View>
								) : null
							}
							renderItem={({ item }) => (
								<Pressable
									accessibilityRole="button"
									disabled={disabled}
									onPress={() => openDetail(item.id)}
									style={({ pressed }) => [styles.expenseCard, pressed && styles.cardPressed]}
								>
									<View style={styles.cardTopRow}>
										<View style={styles.categoryMark}><Text style={styles.categoryMarkText}>-</Text></View>
										<View style={styles.expenseText}>
											<Text style={styles.expenseTitle} numberOfLines={1}>{item.judul}</Text>
											<Text style={styles.expenseMeta}>{item.kategori || 'Tanpa kategori'}  /  {tanggalLokal(item.tanggal)}</Text>
										</View>
										<Text style={styles.expenseAmount}>{rupiah(item.nominal)}</Text>
									</View>
								</Pressable>
							)}
						/>

						{items.length > 0 && (
							<View style={styles.listFooter}>
								<ActionButton title="+  Tambah pengeluaran" onPress={openCreate} disabled={disabled} />
							</View>
						)}
					</>
				)}

				{screen === 'detail' && selected && (
					<ScrollView contentContainerStyle={styles.detailContent} keyboardShouldPersistTaps="handled">
						<View style={styles.detailHero}>
							<Text style={styles.detailLabel}>NOMINAL PENGELUARAN</Text>
							<Text style={styles.detailAmount}>{rupiah(selected.nominal)}</Text>
							<Text style={styles.detailTitle}>{selected.judul}</Text>
						</View>
						<View style={styles.detailsPanel}>
							<DetailRow label="Kategori" value={selected.kategori || (selected.id_kategori ? `Kategori #${selected.id_kategori}` : 'Tanpa kategori')} />
							<DetailRow label="Tanggal" value={tanggalLokal(selected.tanggal)} />
							<DetailRow label="Catatan" value={selected.catatan || 'Belum ada catatan'} last />
						</View>
						<Text style={styles.readOnlyNote}>Tanggal dan catatan hanya dapat dilihat.</Text>
						<View style={styles.actionGroup}>
							<ActionButton title="Ubah pengeluaran" onPress={openEdit} disabled={disabled} />
							<ActionButton title="Hapus" onPress={confirmDelete} disabled={disabled} kind="danger" />
						</View>
					</ScrollView>
				)}

				{(screen === 'create' || screen === 'edit') && (
					<ScrollView contentContainerStyle={styles.formContent} keyboardShouldPersistTaps="handled">
						<Text style={styles.formIntro}>
							{screen === 'create' ? 'Lengkapi informasi pengeluaran baru.' : 'Perbarui judul dan nominal pengeluaran.'}
						</Text>

						<Text style={styles.label}>Judul</Text>
						<TextInput
							style={styles.input}
							value={judul}
							onChangeText={(value) => { setJudul(value); setError(''); }}
							accessibilityLabel="Judul"
							editable={!busy}
							maxLength={100}
							placeholder="Contoh: Makan siang"
							placeholderTextColor="#97A7A1"
							returnKeyType="next"
						/>

						<Text style={styles.label}>Nominal</Text>
						<View style={styles.amountInputWrap}>
							<Text style={styles.currencyPrefix}>Rp</Text>
							<TextInput
								style={styles.amountInput}
								value={nominal}
								onChangeText={(value) => { setNominal(value); setError(''); }}
								accessibilityLabel="Nominal rupiah"
								editable={!busy}
								keyboardType="number-pad"
								placeholder="0"
								placeholderTextColor="#97A7A1"
							/>
						</View>
						<Text style={styles.fieldHint}>Masukkan angka tanpa titik atau koma.</Text>

						{screen === 'create' ? (
							<>
								<Text style={styles.label}>Kategori <Text style={styles.optionalText}>OPSIONAL</Text></Text>
								<View style={styles.categoryOptions}>
									{[{ id: null, nama: 'Tanpa kategori' }, ...categories].map((category) => {
										const checked = categoryId === category.id;
										return (
											<Pressable
												key={String(category.id)}
												accessibilityRole="radio"
												accessibilityState={{ checked }}
												disabled={busy}
												onPress={() => setCategoryId(category.id)}
												style={[styles.categoryOption, checked && styles.categoryOptionSelected]}
											>
												<View style={[styles.radio, checked && styles.radioSelected]}>
													{checked && <View style={styles.radioDot} />}
												</View>
												<Text style={styles.categoryOptionText}>{category.nama}</Text>
											</Pressable>
										);
									})}
								</View>
								<Text style={styles.fieldHint}>Tanggal pengeluaran diisi otomatis oleh server.</Text>
							</>
						) : (
							<Message>Kategori tidak dapat diubah melalui API saat ini.</Message>
						)}

						<View style={styles.formActions}>
							<ActionButton
								title={busy ? 'Menyimpan...' : screen === 'create' ? 'Simpan pengeluaran' : 'Simpan perubahan'}
								onPress={save}
								disabled={disabled}
							/>
							<ActionButton title="Batal" onPress={goBack} disabled={disabled} kind="secondary" />
						</View>
					</ScrollView>
				)}
			</KeyboardAvoidingView>
		</SafeAreaView>
	);
}

function DetailRow({ label, value, last = false }) {
	return (
		<View style={[styles.detailRow, last && styles.detailRowLast]}>
			<Text style={styles.detailRowLabel}>{label}</Text>
			<Text style={styles.detailRowValue}>{value}</Text>
		</View>
	);
}

const styles = StyleSheet.create({
	flex: { flex: 1 },
	page: { flex: 1, backgroundColor: COLORS.canvas, paddingTop: 12 },
	header: { paddingHorizontal: 22, paddingBottom: 18 },
	eyebrow: { color: COLORS.teal, fontSize: 11, fontWeight: '800', letterSpacing: 1.1, marginBottom: 7 },
	heading: { color: COLORS.ink, fontSize: 28, fontWeight: '800' },
	backButton: { alignSelf: 'flex-start', paddingVertical: 6, marginBottom: 5 },
	backText: { color: COLORS.teal, fontSize: 14, fontWeight: '700' },
	errorWrap: { marginHorizontal: 20, marginBottom: 10 },
	message: { borderRadius: 10, paddingHorizontal: 13, paddingVertical: 11, backgroundColor: COLORS.mint, marginVertical: 8 },
	messageText: { color: COLORS.tealDark, fontSize: 14, lineHeight: 20 },
	errorMessage: { backgroundColor: '#FCE9E6' },
	errorText: { color: COLORS.danger, fontSize: 14, lineHeight: 20 },
	retryText: { color: COLORS.teal, fontSize: 14, fontWeight: '700', marginTop: 5 },
	loadingRow: { flexDirection: 'row', alignItems: 'center', gap: 9, paddingHorizontal: 22, paddingBottom: 8 },
	loadingText: { color: COLORS.muted, fontSize: 13 },
	summary: { minHeight: 142, marginHorizontal: 20, marginBottom: 24, padding: 20, borderRadius: 18, backgroundColor: COLORS.tealDark, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
	summaryLabel: { color: '#C1E5DA', fontSize: 13, fontWeight: '600', marginBottom: 9 },
	summaryAmount: { color: COLORS.white, fontSize: 27, fontWeight: '800' },
	countBadge: { width: 72, height: 72, borderRadius: 36, backgroundColor: '#147C6D', alignItems: 'center', justifyContent: 'center' },
	countValue: { color: COLORS.white, fontSize: 21, fontWeight: '800' },
	countLabel: { color: '#C1E5DA', fontSize: 10, marginTop: 1 },
	sectionHeader: { paddingHorizontal: 22, marginBottom: 10, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
	sectionTitle: { color: COLORS.ink, fontSize: 18, fontWeight: '800' },
	refreshText: { color: COLORS.teal, fontSize: 13, fontWeight: '700', paddingVertical: 6 },
	listContent: { paddingHorizontal: 20, paddingBottom: 14 },
	emptyListContent: { flexGrow: 1, paddingHorizontal: 20, paddingBottom: 14 },
	expenseCard: { backgroundColor: COLORS.white, borderWidth: 1, borderColor: COLORS.line, borderRadius: 14, padding: 15, marginBottom: 10 },
	cardPressed: { opacity: 0.76 },
	cardTopRow: { flexDirection: 'row', alignItems: 'center' },
	categoryMark: { width: 42, height: 42, borderRadius: 13, backgroundColor: COLORS.mint, alignItems: 'center', justifyContent: 'center', marginRight: 12 },
	categoryMarkText: { color: COLORS.teal, fontSize: 23, fontWeight: '700', lineHeight: 25 },
	expenseText: { flex: 1, minWidth: 0, marginRight: 8 },
	expenseTitle: { color: COLORS.ink, fontSize: 15, fontWeight: '700', marginBottom: 5 },
	expenseMeta: { color: COLORS.muted, fontSize: 11 },
	expenseAmount: { color: COLORS.ink, fontSize: 13, fontWeight: '800' },
	emptyState: { flex: 1, minHeight: 300, alignItems: 'center', justifyContent: 'center', padding: 22, backgroundColor: COLORS.white, borderWidth: 1, borderColor: COLORS.line, borderRadius: 16 },
	emptyArt: { width: 76, height: 76, borderRadius: 24, backgroundColor: '#EAF6F1', alignItems: 'center', justifyContent: 'center', marginBottom: 17 },
	emptyPaper: { width: 35, height: 43, borderWidth: 1.5, borderColor: '#8BBFB0', borderRadius: 6, backgroundColor: COLORS.white, justifyContent: 'center', paddingHorizontal: 6, gap: 5 },
	emptyPaperLine: { height: 3, borderRadius: 2, backgroundColor: '#B4D9CD' },
	emptyPaperLineShort: { width: '65%' },
	emptyPlusBadge: { position: 'absolute', right: 11, bottom: 10, width: 25, height: 25, borderRadius: 13, backgroundColor: COLORS.teal, alignItems: 'center', justifyContent: 'center' },
	emptyMarkText: { color: COLORS.teal, fontSize: 27, fontWeight: '500' },
	emptyTitle: { color: COLORS.ink, fontSize: 17, fontWeight: '700', textAlign: 'center' },
	emptyBody: { color: COLORS.muted, fontSize: 13, lineHeight: 20, textAlign: 'center', marginTop: 6 },
	emptyAction: { width: '100%', marginTop: 17 },
	listFooter: { paddingHorizontal: 20, paddingTop: 10, paddingBottom: Platform.OS === 'ios' ? 18 : 14, backgroundColor: COLORS.canvas },
	button: { minHeight: 50, borderRadius: 12, backgroundColor: COLORS.teal, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 16 },
	buttonSecondary: { backgroundColor: COLORS.white, borderWidth: 1, borderColor: COLORS.line },
	buttonDanger: { backgroundColor: '#FCE9E6' },
	buttonPressed: { opacity: 0.78 },
	buttonText: { color: COLORS.white, fontSize: 15, fontWeight: '700' },
	buttonSecondaryText: { color: COLORS.ink },
	buttonDangerText: { color: COLORS.danger },
	disabled: { opacity: 0.5 },
	detailContent: { paddingHorizontal: 20, paddingBottom: 28 },
	detailHero: { backgroundColor: COLORS.tealDark, borderRadius: 18, padding: 22, marginBottom: 14 },
	detailLabel: { color: '#C1E5DA', fontSize: 11, fontWeight: '800', letterSpacing: 0.8 },
	detailAmount: { color: COLORS.white, fontSize: 30, fontWeight: '800', marginTop: 12 },
	detailTitle: { color: '#D5EEE6', fontSize: 15, marginTop: 8 },
	detailsPanel: { backgroundColor: COLORS.white, borderRadius: 14, borderWidth: 1, borderColor: COLORS.line, paddingHorizontal: 16 },
	detailRow: { borderBottomWidth: 1, borderBottomColor: COLORS.line, paddingVertical: 15, gap: 6 },
	detailRowLast: { borderBottomWidth: 0 },
	detailRowLabel: { color: COLORS.muted, fontSize: 12 },
	detailRowValue: { color: COLORS.ink, fontSize: 15, fontWeight: '600' },
	readOnlyNote: { color: COLORS.muted, fontSize: 12, lineHeight: 18, marginTop: 12, marginBottom: 18 },
	actionGroup: { gap: 10 },
	formContent: { paddingHorizontal: 20, paddingBottom: 30 },
	formIntro: { color: COLORS.muted, fontSize: 14, lineHeight: 21, marginBottom: 14 },
	label: { color: COLORS.ink, fontSize: 14, fontWeight: '700', marginTop: 16, marginBottom: 8 },
	optionalText: { color: COLORS.muted, fontSize: 10, fontWeight: '700' },
	input: { minHeight: 52, borderWidth: 1, borderColor: COLORS.line, borderRadius: 12, paddingHorizontal: 14, backgroundColor: COLORS.white, color: COLORS.ink, fontSize: 15 },
	amountInputWrap: { minHeight: 52, flexDirection: 'row', alignItems: 'center', borderWidth: 1, borderColor: COLORS.line, borderRadius: 12, paddingHorizontal: 14, backgroundColor: COLORS.white },
	currencyPrefix: { color: COLORS.muted, fontSize: 15, fontWeight: '700', marginRight: 10 },
	amountInput: { flex: 1, color: COLORS.ink, fontSize: 15, paddingVertical: 12 },
	fieldHint: { color: COLORS.muted, fontSize: 12, lineHeight: 18, marginTop: 7 },
	categoryOptions: { gap: 8 },
	categoryOption: { minHeight: 48, flexDirection: 'row', alignItems: 'center', borderWidth: 1, borderColor: COLORS.line, backgroundColor: COLORS.white, borderRadius: 11, paddingHorizontal: 13 },
	categoryOptionSelected: { borderColor: COLORS.teal, backgroundColor: '#ECF8F3' },
	categoryOptionText: { color: COLORS.ink, fontSize: 14 },
	radio: { width: 19, height: 19, borderRadius: 10, borderWidth: 1.5, borderColor: '#A5B5AF', alignItems: 'center', justifyContent: 'center', marginRight: 11 },
	radioSelected: { borderColor: COLORS.teal },
	radioDot: { width: 9, height: 9, borderRadius: 5, backgroundColor: COLORS.teal },
	formActions: { gap: 9, marginTop: 24 },
});